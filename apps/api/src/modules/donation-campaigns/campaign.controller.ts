import type { RequestHandler } from 'express';
import { paramId } from '../../common/helpers/http';
import {
  sendCreated,
  sendList,
  sendSuccess,
} from '../../common/helpers/response';
import { auditContextFrom } from '../audit-logs/audit.service';
import { campaignService } from './campaign.service';

export const list: RequestHandler = async (req, res) => {
  const { items, meta } = await campaignService.list(req.query);
  sendList(res, items, meta.page, meta.limit, meta.total);
};

export const getById: RequestHandler = async (req, res) => {
  sendSuccess(res, await campaignService.getById(paramId(req)));
};

export const create: RequestHandler = async (req, res) => {
  sendCreated(
    res,
    await campaignService.create(req.body, auditContextFrom(req)),
  );
};

export const update: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await campaignService.update(paramId(req), req.body, auditContextFrom(req)),
  );
};

export const open: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await campaignService.open(paramId(req), auditContextFrom(req)),
  );
};

export const close: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await campaignService.close(paramId(req), auditContextFrom(req)),
  );
};

export const cancel: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await campaignService.cancel(paramId(req), req.body, auditContextFrom(req)),
  );
};
