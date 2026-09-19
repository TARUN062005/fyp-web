import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteClustersBodySchema,
  deleteReportParamsSchema,
  deleteReportsBodySchema,
  mergeClustersBodySchema,
} from '../validators/adminOps.validators.js';

describe('deleteReportParamsSchema', () => {
  it('accepts mongo ids and message ids', () => {
    assert.equal(
      deleteReportParamsSchema.parse({ reportId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }).reportId,
      'aaaaaaaaaaaaaaaaaaaaaaaa'
    );
    assert.equal(
      deleteReportParamsSchema.parse({ reportId: 'msg-sos-1' }).reportId,
      'msg-sos-1'
    );
  });

  it('rejects a blank reportId', () => {
    assert.throws(() => deleteReportParamsSchema.parse({ reportId: '' }));
  });
});

describe('mergeClustersBodySchema', () => {
  it('accepts a pair or three-plus clusterIds', () => {
    assert.deepEqual(
      mergeClustersBodySchema.parse({
        sourceClusterId: 'CLUSTER-A',
        targetClusterId: 'CLUSTER-B',
      }),
      { sourceClusterId: 'CLUSTER-A', targetClusterId: 'CLUSTER-B' }
    );
    const multi = mergeClustersBodySchema.parse({
      clusterIds: ['CLUSTER-A', 'CLUSTER-B', 'CLUSTER-C'],
    });
    assert.equal(multi.clusterIds.length, 3);
  });

  it('rejects a single cluster id list', () => {
    assert.throws(() =>
      mergeClustersBodySchema.parse({ clusterIds: ['CLUSTER-A'] })
    );
    assert.throws(() => mergeClustersBodySchema.parse({}));
  });
});

describe('deleteClustersBodySchema', () => {
  it('accepts one or many cluster ids', () => {
    assert.equal(
      deleteClustersBodySchema.parse({ clusterIds: ['CLUSTER-A'] }).clusterIds
        .length,
      1
    );
    assert.equal(
      deleteClustersBodySchema.parse({
        clusterIds: ['CLUSTER-A', 'CLUSTER-B', 'CLUSTER-C'],
      }).clusterIds.length,
      3
    );
  });

  it('rejects an empty list', () => {
    assert.throws(() => deleteClustersBodySchema.parse({ clusterIds: [] }));
  });
});

describe('deleteReportsBodySchema', () => {
  it('accepts a group of report ids', () => {
    assert.equal(
      deleteReportsBodySchema.parse({ reportIds: ['r1', 'r2'] }).reportIds
        .length,
      2
    );
  });

  it('rejects an empty list', () => {
    assert.throws(() => deleteReportsBodySchema.parse({ reportIds: [] }));
  });
});
