from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import blackjack, slots

app = FastAPI(
    title="KruKasyno Game Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "game-service"}


app.include_router(blackjack.router, prefix="/games")
app.include_router(slots.router, prefix="/games")
