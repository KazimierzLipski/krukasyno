from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import create_tables
from .routers.wallet import router as wallet_router

app = FastAPI(
    title="KruKasyno Wallet Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "wallet-service"}


app.include_router(wallet_router)
