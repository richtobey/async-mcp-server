import asyncio
import logging
import os
import uuid
from urllib.parse import parse_qs

from starlette.requests import Request
from starlette.websockets import WebSocket
from typing import AsyncGenerator, Dict, Set

import strawberry
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter


@strawberry.type
class Job:
    id: strawberry.ID
    status: str
    progress: int
    result: str | None


@strawberry.type
class JobUpdate:
    id: strawberry.ID
    status: str
    progress: int
    message: str | None
    result: str | None


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backend")

job_store: Dict[str, Job] = {}
subscribers: Dict[str, Set[asyncio.Queue]] = {}
API_TOKEN = os.getenv("GRAPHQL_API_TOKEN")


def get_auth_header(info) -> str | None:
    context = info.context
    request = None
    websocket = None
    connection_params = None

    if isinstance(context, Request):
        request = context
    elif isinstance(context, WebSocket):
        websocket = context
    else:
        request = _get_context_value(context, "request")
        websocket = _get_context_value(context, "websocket")
        connection_params = _get_context_value(context, "connection_params")
    if request is not None:
        auth = request.headers.get("authorization")
        if auth:
            return auth
    if websocket is not None:
        auth = websocket.headers.get("authorization")
        if auth:
            return auth
        query_auth = websocket.query_params.get("authorization") or websocket.query_params.get("Authorization")
        if query_auth:
            return query_auth
        scope = getattr(websocket, "scope", {}) or {}
        raw_query = scope.get("query_string")
        if raw_query:
            if isinstance(raw_query, bytes):
                raw_query = raw_query.decode("utf-8", errors="ignore")
            params = parse_qs(raw_query)
            for key in ("authorization", "Authorization"):
                values = params.get(key)
                if values:
                    return values[0]
    if isinstance(connection_params, dict):
        auth = connection_params.get("Authorization") or connection_params.get("authorization")
        if isinstance(auth, str):
            return auth
    auth = extract_auth_from_params(connection_params)
    if auth:
        return auth
    return None


def _get_context_value(context, key: str):
    if isinstance(context, dict):
        return context.get(key)
    return getattr(context, key, None)


def extract_auth_from_params(params) -> str | None:
    if not params:
        return None
    if isinstance(params, str):
        return params
    if isinstance(params, dict):
        value = params.get("Authorization") or params.get("authorization")
        return value if isinstance(value, str) else None
    getter = getattr(params, "get", None)
    if callable(getter):
        value = getter("Authorization") or getter("authorization")
        return value if isinstance(value, str) else None
    return None


def mask_token(value: str | None) -> str:
    if not value:
        return "none"
    if value.startswith("Bearer "):
        token = value[7:]
        if len(token) <= 8:
            return "Bearer " + "*" * len(token)
        return "Bearer " + token[:4] + "..." + token[-4:]
    if len(value) <= 8:
        return "*" * len(value)
    return value[:4] + "..." + value[-4:]


def describe_context(context) -> str:
    if isinstance(context, Request):
        return "Request"
    if isinstance(context, WebSocket):
        try:
            return f"WebSocket query={context.url.query}"
        except Exception:
            return "WebSocket"
    if isinstance(context, dict):
        return f"dict keys={list(context.keys())}"
    return f"{type(context).__name__}"


def require_auth(info) -> None:
    if not API_TOKEN:
        return
    auth = get_auth_header(info)
    expected = f"Bearer {API_TOKEN}"
    if auth != expected:
        context = info.context
        connection_params = (
            _get_context_value(context, "connection_params")
            if not isinstance(context, (Request, WebSocket))
            else None
        )
        logger.warning(
            "Unauthorized request auth=%s expected=%s context=%s connection_params=%s",
            mask_token(auth),
            mask_token(expected),
            describe_context(info.context),
            mask_token(extract_auth_from_params(connection_params)),
        )
        raise strawberry.exceptions.GraphQLError("Unauthorized")


async def publish(job_id: str, update: JobUpdate) -> None:
    logger.info("Publish job=%s status=%s progress=%s", job_id, update.status, update.progress)
    for queue in list(subscribers.get(job_id, set())):
        await queue.put(update)


async def run_job(job_id: str, input_text: str) -> None:
    logger.info("Job %s started input=%s", job_id, input_text)
    total_steps = 5
    for step in range(1, total_steps + 1):
        await asyncio.sleep(1)
        progress = int(step / total_steps * 100)
        message = f"step {step} of {total_steps}"
        logger.info("Job %s progress=%s message=%s", job_id, progress, message)
        update = JobUpdate(
            id=strawberry.ID(job_id),
            status="running",
            progress=progress,
            message=message,
            result=None,
        )
        await publish(job_id, update)

    result = f"processed: {input_text}"
    job_store[job_id] = Job(id=strawberry.ID(job_id), status="complete", progress=100, result=result)
    logger.info("Job %s complete", job_id)
    await publish(
        job_id,
        JobUpdate(
            id=strawberry.ID(job_id),
            status="complete",
            progress=100,
            message="done",
            result=result,
        ),
    )


@strawberry.type
class Query:
    @strawberry.field
    def job(self, info: strawberry.Info, id: strawberry.ID) -> Job | None:
        require_auth(info)
        return job_store.get(str(id))


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def start_job(self, info: strawberry.Info, input: str) -> Job:
        require_auth(info)
        job_id = str(uuid.uuid4())
        job = Job(id=strawberry.ID(job_id), status="queued", progress=0, result=None)
        job_store[job_id] = job
        logger.info("Job %s queued input=%s", job_id, input)
        asyncio.create_task(run_job(job_id, input))
        return job


@strawberry.type
class Subscription:
    @strawberry.subscription
    async def job_updates(
        self, info: strawberry.Info, id: strawberry.ID
    ) -> AsyncGenerator[JobUpdate, None]:
        require_auth(info)
        queue: asyncio.Queue = asyncio.Queue()
        subscribers.setdefault(str(id), set()).add(queue)
        logger.info("Job %s subscriber added", id)
        try:
            while True:
                update = await queue.get()
                yield update
        finally:
            subscribers[str(id)].discard(queue)
            logger.info("Job %s subscriber removed", id)


schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription)

app = FastAPI()
app.include_router(GraphQLRouter(schema), prefix="/graphql")
