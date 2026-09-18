import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deleteReportParamsSchema } from '../validators/adminOps.validators.js';

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
