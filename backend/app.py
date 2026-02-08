import asyncio
import os
import uuid
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


job_store: Dict[str, Job] = {}
subscribers: Dict[str, Set[asyncio.Queue]] = {}
API_TOKEN = os.getenv("GRAPHQL_API_TOKEN")


def get_auth_header(info) -> str | None:
    context = info.context
    request = context.get("request")
    websocket = context.get("websocket")
    connection_params = context.get("connection_params") if isinstance(context, dict) else None
    if request is not None:
        return request.headers.get("authorization")
    if websocket is not None:
        return websocket.headers.get("authorization")
    if isinstance(connection_params, dict):
        auth = connection_params.get("Authorization") or connection_params.get("authorization")
        if isinstance(auth, str):
            return auth
    return None


def require_auth(info) -> None:
    if not API_TOKEN:
        return
    auth = get_auth_header(info)
    expected = f"Bearer {API_TOKEN}"
    if auth != expected:
        raise strawberry.exceptions.GraphQLError("Unauthorized")


async def publish(job_id: str, update: JobUpdate) -> None:
    for queue in list(subscribers.get(job_id, set())):
        await queue.put(update)


async def run_job(job_id: str, input_text: str) -> None:
    total_steps = 5
    for step in range(1, total_steps + 1):
        await asyncio.sleep(1)
        progress = int(step / total_steps * 100)
        message = f"step {step} of {total_steps}"
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
        try:
            while True:
                update = await queue.get()
                yield update
        finally:
            subscribers[str(id)].discard(queue)


schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription)

app = FastAPI()
app.include_router(GraphQLRouter(schema), prefix="/graphql")
