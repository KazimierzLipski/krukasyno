export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  jwtSecret: process.env.JWT_SECRET ?? '',
  serviceApiKey: process.env.SERVICE_API_KEY ?? '',
  services: {
    player: process.env.PLAYER_SERVICE_URL ?? 'http://player-service:5000',
    game: process.env.GAME_SERVICE_URL ?? 'http://game-service:6100',
    wallet: process.env.WALLET_SERVICE_URL ?? 'http://wallet-service:7000',
  },
};
