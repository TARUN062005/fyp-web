import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExperimentPdfBuffer,
  buildAllExperimentsPdfBuffer,
  experimentReportFilename,
  allExperimentsReportFilename,
} from '../services/experimentReportPdf.js';
import { calculateExperimentResults } from '../services/experimentMetrics.js';

const pdfText = (pdf) => {
  const latin1 = pdf.toString('latin1');
  const hexParts = [...latin1.matchAll(/<([0-9a-fA-F]+)>/g)].map((m) => m[1]).join('');
  return Buffer.from(hexParts, 'hex').toString('latin1');
};

describe('experiment PDF', () => {
  it('builds a PDF from physical-device results without fabricating zeros', async () => {
    const events = [
      {
        eventId: 'e1',
        experimentId: 'exp-pdf',
        trialId: 'trial-pdf',
        messageId: 'msg-pdf',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'phone-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1_000,
        clockOffsetMs: 0,
        clockUncertaintyMs: 15,
        scenario: 'DIRECT_BROADCAST',
        hopCount: 0,
        sourceDeviceId: 'phone-a',
        destinationDeviceId: 'phone-b',
      },
      {
        eventId: 'e2',
        experimentId: 'exp-pdf',
        trialId: 'trial-pdf',
        messageId: 'msg-pdf',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'phone-b',
        meshUserId: 'mesh-b',
        wallClockMs: 1_180,
        clockOffsetMs: 0,
        clockUncertaintyMs: 15,
        scenario: 'DIRECT_BROADCAST',
        hopCount: 1,
      },
    ];
    const calculated = calculateExperimentResults(events);
    const pdf = await buildExperimentPdfBuffer({
      experiment: {
        experimentId: 'exp-pdf',
        joinCode: 'ABC123',
        name: 'Direct broadcast lab',
        scenario: 'DIRECT_BROADCAST',
        status: 'COMPLETED',
        participantCount: 2,
        startedAt: new Date('2026-11-13T10:00:00.000Z'),
        endedAt: new Date('2026-11-13T10:20:00.000Z'),
        description: 'Two-phone Nearby broadcast',
        notes: '',
        appVersion: '1.0',
        createdAt: new Date('2026-11-13T10:00:00.000Z'),
      },
      devices: [
        {
          deviceId: 'phone-a',
          meshUserId: 'mesh-a',
          model: 'Pixel 7',
          androidVersion: '14',
          appVersion: '1.0',
          role: 'SENDER',
          clockOffsetMs: 0,
          clockUncertaintyMs: 15,
        },
        {
          deviceId: 'phone-b',
          meshUserId: 'mesh-b',
          model: 'Pixel 6',
          androidVersion: '13',
          appVersion: '1.0',
          role: 'RECEIVER',
          clockOffsetMs: 0,
          clockUncertaintyMs: 15,
        },
      ],
      trials: calculated.trials,
      summary: calculated.summary,
      byScenario: calculated.byScenario,
      audits: [],
    });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const latin1 = pdf.toString('latin1');
    assert.equal(latin1.includes('(EmergencyDTN)'), true);
    assert.equal(latin1.includes('Physical Android device experiment results'), true);
    assert.equal(pdf.length > 1000, true);
    assert.equal(experimentReportFilename(new Date('2026-11-13T12:00:00Z')),
      'EmergencyDTN_Experiment_Report_2026-11-13.pdf');
  });

  it('builds a combined PDF with every experiment name and result', async () => {
    const events = [
      {
        eventId: 'e1',
        experimentId: 'exp-pdf',
        trialId: 'trial-pdf',
        messageId: 'msg-pdf',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'phone-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1_000,
        clockOffsetMs: 0,
        clockUncertaintyMs: 15,
        scenario: 'DIRECT_BROADCAST',
        hopCount: 0,
        sourceDeviceId: 'phone-a',
        destinationDeviceId: 'phone-b',
      },
      {
        eventId: 'e2',
        experimentId: 'exp-pdf',
        trialId: 'trial-pdf',
        messageId: 'msg-pdf',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'phone-b',
        meshUserId: 'mesh-b',
        wallClockMs: 1_180,
        clockOffsetMs: 0,
        clockUncertaintyMs: 15,
        scenario: 'DIRECT_BROADCAST',
        hopCount: 1,
      },
    ];
    const calculated = calculateExperimentResults(events);
    const bundle = {
      experiment: {
        experimentId: 'exp-pdf',
        joinCode: 'ABC123',
        name: 'Direct broadcast lab',
        scenario: 'DIRECT_BROADCAST',
        status: 'COMPLETED',
        participantCount: 2,
        startedAt: new Date('2026-11-13T10:00:00.000Z'),
        endedAt: new Date('2026-11-13T10:20:00.000Z'),
        description: 'Two-phone Nearby broadcast',
        notes: '',
        appVersion: '1.0',
        createdAt: new Date('2026-11-13T10:00:00.000Z'),
      },
      devices: [
        {
          deviceId: 'phone-a',
          meshUserId: 'mesh-a',
          model: 'Pixel 7',
          androidVersion: '14',
          appVersion: '1.0',
          role: 'SENDER',
          clockOffsetMs: 0,
          clockUncertaintyMs: 15,
        },
      ],
      trials: calculated.trials,
      summary: calculated.summary,
      byScenario: calculated.byScenario,
      audits: [],
    };
    const pdf = await buildAllExperimentsPdfBuffer([
      bundle,
      {
        ...bundle,
        experiment: {
          ...bundle.experiment,
          experimentId: 'exp-chat',
          name: 'Lab Test 2 Chat',
          scenario: 'PRIVATE_CHAT',
          status: 'COMPLETED',
        },
      },
    ]);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const text = pdfText(pdf);
    assert.equal(text.includes('Direct broadcast lab'), true);
    assert.equal(text.includes('Lab Test 2 Chat'), true);
    assert.equal(text.includes('Catalogue'), true);
    assert.equal(text.includes('exp-pdf'), true);
    assert.equal(text.includes('exp-chat'), true);
    assert.equal(text.includes('100%'), true);
    assert.equal(pdf.length > 1000, true);
    assert.equal(
      allExperimentsReportFilename(new Date('2026-11-13T12:00:00Z')),
      'EmergencyDTN_All_Experiments_2026-11-13.pdf'
    );
  });
});
