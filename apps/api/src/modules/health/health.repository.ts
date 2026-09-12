import { database } from '../../config/database';
export const healthRepository = {
  async ping(): Promise<void> {
    await database.$queryRaw`SELECT 1`;
  },
};
