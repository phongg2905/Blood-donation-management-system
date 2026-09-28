import { database } from '../../config/database';

export const certificateRepository = {
  findById: (id: string) => database.certificate.findUnique({ where: { id } }),
  setFileUrl: (id: string, fileUrl: string) =>
    database.certificate.update({ where: { id }, data: { fileUrl } }),
};
