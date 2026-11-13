import crypto from 'crypto';
import mongoose from 'mongoose';
import Experiment from '../models/Experiment.js';
import ExperimentDevice from '../models/ExperimentDevice.js';
import ExperimentEvent from '../models/ExperimentEvent.js';
import ExperimentUploadAudit from '../models/ExperimentUploadAudit.js';
import {
  JOIN_CODE_ALPHABET,
  MEASUREMENT_KIND_PHYSICAL,
} from '../config/experimentConstants.js';
import { calculateExperimentResults } from './experimentMetrics.js';

const generateJoinCode = () => {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i += 1) {
    code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  }
  return code;
};

const httpError = (statusCode, message, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
};

export const createExperiment = async (userId, body) => {
  const existing = await Experiment.findOne({ experimentId: body.experimentId });
  if (existing) {
    if (String(existing.createdByUserId) !== String(userId)) {
      throw httpError(409, 'Experiment ID already exists', 'EXPERIMENT_ID_TAKEN');
    }
    return existing.toObject();
  }

  let joinCode = (body.joinCode || generateJoinCode()).toUpperCase();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const clash = await Experiment.findOne({ joinCode });
    if (!clash) break;
    joinCode = generateJoinCode();
  }

  const doc = await Experiment.create({
    experimentId: body.experimentId,
    joinCode,
    name: body.name,
    scenario: body.scenario,
    participantCount: body.participantCount,
    description: body.description || '',
    notes: body.notes || '',
    createdByUserId: userId,
    startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
    appVersion: body.appVersion || '',
    measurementKind: MEASUREMENT_KIND_PHYSICAL,
    status: 'ACTIVE',
  });
  return doc.toObject();
};

export const joinExperimentByCode = async (userId, joinCode) => {
  const experiment = await Experiment.findOne({ joinCode: joinCode.toUpperCase() });
  if (!experiment) {
    throw httpError(404, 'Unknown join code', 'JOIN_CODE_NOT_FOUND');
  }
  return experiment.toObject();
};

const userCanAccessExperiment = async (userId, experimentId) => {
  const experiment = await Experiment.findOne({ experimentId });
  if (!experiment) return { experiment: null, allowed: false };
  if (String(experiment.createdByUserId) === String(userId)) {
    return { experiment, allowed: true, asOwner: true };
  }
  const device = await ExperimentDevice.findOne({
    experimentId,
    userId,
  });
  return { experiment, allowed: Boolean(device), asOwner: false };
};

export const listExperimentsForUser = async (userId, query) => {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const deviceRows = await ExperimentDevice.find({ userId }).select('experimentId');
  const ids = [
    ...new Set(deviceRows.map((d) => d.experimentId)),
  ];
  const filter = {
    $or: [{ createdByUserId: userId }, { experimentId: { $in: ids } }],
  };
  if (query.status) filter.status = query.status;
  if (query.scenario) filter.scenario = query.scenario;

  const [items, total] = await Promise.all([
    Experiment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Experiment.countDocuments(filter),
  ]);
  return { items, total, page, limit };
};

export const listExperimentsForAdmin = async (query) => {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.scenario) filter.scenario = query.scenario;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const [items, total] = await Promise.all([
    Experiment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Experiment.countDocuments(filter),
  ]);

  const experimentIds = items.map((e) => e.experimentId);
  const [devices, events] = await Promise.all([
    ExperimentDevice.find({ experimentId: { $in: experimentIds } }).lean(),
    ExperimentEvent.find({ experimentId: { $in: experimentIds } }).lean(),
  ]);

  const devicesByExp = new Map();
  for (const d of devices) {
    if (!devicesByExp.has(d.experimentId)) devicesByExp.set(d.experimentId, []);
    devicesByExp.get(d.experimentId).push(d);
  }
  const eventsByExp = new Map();
  for (const ev of events) {
    if (!eventsByExp.has(ev.experimentId)) eventsByExp.set(ev.experimentId, []);
    eventsByExp.get(ev.experimentId).push(ev);
  }

  const enriched = items.map((item) => {
    const result = calculateExperimentResults(
      eventsByExp.get(item.experimentId) || [],
      devicesByExp.get(item.experimentId) || []
    );
    return {
      ...item,
      participatingDevices: (devicesByExp.get(item.experimentId) || []).length,
      trialCount: result.summary.totalTrialCount,
      successfulDeliveries: result.summary.successfulDeliveries,
      failedDeliveries: result.summary.failedTrialCount,
      deliveryRatio: result.summary.deliveryRatio,
      measurementKind: MEASUREMENT_KIND_PHYSICAL,
    };
  });

  return { items: enriched, total, page, limit };
};

export const getExperimentForUser = async (userId, experimentId) => {
  const { experiment, allowed } = await userCanAccessExperiment(userId, experimentId);
  if (!experiment) throw httpError(404, 'Experiment not found');
  if (!allowed) throw httpError(403, 'Not allowed to read this experiment');
  return experiment.toObject();
};

export const getExperimentForAdmin = async (experimentId) => {
  const experiment = await Experiment.findOne({ experimentId }).lean();
  if (!experiment) throw httpError(404, 'Experiment not found');
  return experiment;
};

export const deleteExperimentBundle = async (experimentId) => {
  const experiment = await Experiment.findOne({ experimentId });
  if (!experiment) throw httpError(404, 'Experiment not found');
  await Promise.all([
    ExperimentEvent.deleteMany({ experimentId }),
    ExperimentDevice.deleteMany({ experimentId }),
    ExperimentUploadAudit.deleteMany({ experimentId }),
  ]);
  await Experiment.deleteOne({ experimentId });
  return { experimentId, deleted: true };
};

export const deleteExperimentForUser = async (userId, experimentId) => {
  const { experiment, allowed, asOwner } = await userCanAccessExperiment(
    userId,
    experimentId
  );
  if (!experiment) throw httpError(404, 'Experiment not found');
  if (!allowed || !asOwner) {
    throw httpError(403, 'Only the experiment owner can delete this experiment');
  }
  return deleteExperimentBundle(experimentId);
};

export const updateExperimentStatus = async (userId, experimentId, status) => {
  const { experiment, allowed, asOwner } = await userCanAccessExperiment(
    userId,
    experimentId
  );
  if (!experiment) throw httpError(404, 'Experiment not found');
  if (!allowed || !asOwner) {
    throw httpError(403, 'Only the experiment owner can change status');
  }
  experiment.status = status;
  if (status === 'COMPLETED') experiment.endedAt = new Date();
  if (status === 'ACTIVE') experiment.endedAt = null;
  await experiment.save();
  return experiment.toObject();
};

export const registerDevice = async (userId, experimentId, body) => {
  const experiment = await Experiment.findOne({ experimentId });
  if (!experiment) throw httpError(404, 'Experiment not found');
  if (experiment.status === 'COMPLETED') {
    throw httpError(409, 'Experiment is completed', 'EXPERIMENT_COMPLETED');
  }

  const updated = await ExperimentDevice.findOneAndUpdate(
    { experimentId, deviceId: body.deviceId },
    {
      $set: {
        userId,
        meshUserId: body.meshUserId,
        model: body.model || '',
        androidVersion: body.androidVersion || '',
        appVersion: body.appVersion || '',
        role: body.role,
        clockOffsetMs: body.clockOffsetMs ?? null,
        clockUncertaintyMs: body.clockUncertaintyMs ?? null,
        lastSeenAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return updated.toObject();
};

export const ingestEventBatch = async (userId, experimentId, body) => {
  const experiment = await Experiment.findOne({ experimentId });
  if (!experiment) throw httpError(404, 'Experiment not found');

  const device = await ExperimentDevice.findOne({
    experimentId,
    userId,
    deviceId: body.deviceId,
  });
  const isOwner = String(experiment.createdByUserId) === String(userId);
  if (!device && !isOwner) {
    throw httpError(403, 'Device is not registered on this experiment');
  }

  const rejectedReasons = [];
  const valid = [];
  for (const event of body.events) {
    if (event.scenario !== experiment.scenario && event.eventType !== 'TRIAL_SKIPPED') {
      // Trials may use a different scenario than the experiment primary scenario.
    }
    if (event.deviceId !== body.deviceId && !isOwner) {
      rejectedReasons.push(`${event.eventId}:device_mismatch`);
      continue;
    }
    const payload = {
      ...event,
      experimentId,
      userId,
      extra: event.extra,
    };
    try {
      const doc = new ExperimentEvent(payload);
      const validation = doc.validateSync();
      if (validation) {
        rejectedReasons.push(`${event.eventId}:invalid`);
        continue;
      }
    } catch (err) {
      rejectedReasons.push(
        `${event.eventId}:invalid:${err?.message || 'validation'}`
      );
      continue;
    }
    valid.push(payload);
  }

  let insertedCount = 0;
  let duplicateCount = 0;
  if (valid.length) {
    try {
      const inserted = await ExperimentEvent.insertMany(valid, { ordered: false });
      insertedCount = inserted.length;
    } catch (err) {
      if (err.code === 11000 || err.writeErrors) {
        insertedCount = err.insertedDocs?.length || err.result?.nInserted || 0;
        const writeErrors = err.writeErrors || [];
        duplicateCount = writeErrors.filter((e) => e.code === 11000).length;
        if (!insertedCount && err.result?.result) {
          insertedCount = err.result.result.nInserted || 0;
        }
        // Mongoose 8 bulk: result.insertedCount
        if (typeof err.insertedCount === 'number') {
          insertedCount = err.insertedCount;
        }
        if (!duplicateCount) {
          duplicateCount = Math.max(0, valid.length - insertedCount - rejectedReasons.length);
        }
      } else {
        throw err;
      }
    }
  }

  await ExperimentUploadAudit.create({
    experimentId,
    userId,
    deviceId: body.deviceId,
    receivedCount: body.events.length,
    insertedCount,
    duplicateCount,
    rejectedCount: rejectedReasons.length,
    rejectedReasons: rejectedReasons.slice(0, 50),
  });

  return {
    received: body.events.length,
    inserted: insertedCount,
    duplicates: duplicateCount,
    rejected: rejectedReasons.length,
    rejectedReasons,
  };
};

export const loadExperimentBundle = async (experimentId) => {
  const experiment = await Experiment.findOne({ experimentId }).lean();
  if (!experiment) throw httpError(404, 'Experiment not found');
  const [devices, events, audits] = await Promise.all([
    ExperimentDevice.find({ experimentId }).lean(),
    ExperimentEvent.find({ experimentId }).sort({ wallClockMs: 1 }).lean(),
    ExperimentUploadAudit.find({ experimentId }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  const calculated = calculateExperimentResults(events, devices);
  return {
    experiment: {
      ...experiment,
      measurementKind: MEASUREMENT_KIND_PHYSICAL,
    },
    devices,
    events,
    audits,
    ...calculated,
  };
};

export const paginateTrials = (trials, query) => {
  let filtered = trials;
  if (query.scenario) {
    filtered = filtered.filter((t) => t.scenario === query.scenario);
  }
  if (query.delivered === true) filtered = filtered.filter((t) => t.delivered);
  if (query.delivered === false) filtered = filtered.filter((t) => !t.delivered && !t.skipped);
  if (query.deviceId) {
    filtered = filtered.filter(
      (t) =>
        t.senderDeviceId === query.deviceId ||
        t.destinationDeviceId === query.deviceId
    );
  }
  const page = query.page || 1;
  const limit = query.limit || 50;
  const start = (page - 1) * limit;
  return {
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
  };
};

export { mongoose };
