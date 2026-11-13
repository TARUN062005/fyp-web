import PDFDocument from 'pdfkit';
import { METRIC_DEFINITIONS } from '../config/experimentConstants.js';

const fmt = (value, suffix = '') => {
  if (value == null || value === '') return 'unavailable';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'unavailable';
  return `${value}${suffix}`;
};

const fmtMs = (value) => {
  if (value == null || !Number.isFinite(value)) return 'unavailable';
  return `${Math.round(value)} ms`;
};

const fmtPct = (value) => {
  if (value == null || !Number.isFinite(value)) return 'unavailable';
  return `${value}%`;
};

const iso = (value) => {
  if (!value) return 'unavailable';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'unavailable';
  return d.toISOString();
};

const drawKv = (doc, label, value) => {
  doc.font('Helvetica-Bold').fontSize(9).text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(String(value));
};

const drawSection = (doc, title) => {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text(title);
  doc.moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor('#cccccc')
    .stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor('#222222');
};

const barChart = (doc, title, rows, valueKey, unit = '') => {
  if (doc.y > 620) doc.addPage();
  doc.font('Helvetica-Bold').fontSize(10).text(title);
  doc.moveDown(0.3);
  const usable = rows.filter((r) => r[valueKey] != null && Number.isFinite(r[valueKey]));
  if (!usable.length) {
    doc.font('Helvetica-Oblique').fontSize(9).text('No measured values available.');
    doc.moveDown(0.4);
    return;
  }
  const max = Math.max(...usable.map((r) => r[valueKey]), 1);
  const left = doc.page.margins.left;
  const width = 360;
  for (const row of usable) {
    const barW = Math.max(2, (row[valueKey] / max) * width);
    doc.font('Helvetica').fontSize(8).text(row.label, left, doc.y);
    const y = doc.y + 2;
    doc.rect(left + 130, y, barW, 10).fill('#2563eb');
    doc.fillColor('#111111').text(
      `${row[valueKey]}${unit}`,
      left + 136 + barW,
      y - 1
    );
    doc.moveDown(0.7);
    doc.fillColor('#222222');
  }
  doc.moveDown(0.3);
};

export const buildExperimentPdfBuffer = (bundle) => {
  const { experiment, devices, trials, summary, byScenario, audits } = bundle;
  const generatedAt = new Date();
  const dateStamp = generatedAt.toISOString().slice(0, 10);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      compress: false,
      margins: { top: 48, bottom: 48, left: 48, right: 48 },
      info: {
        Title: `EmergencyDTN Experiment Report ${experiment.experimentId}`,
        Author: 'EmergencyDTN',
        Subject: 'Physical Android device experiment results',
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text('EmergencyDTN');
    doc.font('Helvetica').fontSize(11).text('Physical-device experiment report');
    doc.moveDown(0.4);
    doc.fontSize(8).fillColor('#555555').text(
      'This report uses backend-validated event records from physical Android phones. ' +
        'It does not include simulator results. Missing measurements are shown as unavailable — never as zero.'
    );
    doc.fillColor('#222222');

    drawSection(doc, '1. Experiment identification');
    drawKv(doc, 'Experiment title', experiment.name);
    drawKv(doc, 'Experiment ID', experiment.experimentId);
    drawKv(doc, 'Join code', experiment.joinCode);
    drawKv(doc, 'Primary scenario', experiment.scenario);
    drawKv(doc, 'Status', experiment.status);
    drawKv(doc, 'Measurement kind', 'PHYSICAL_ANDROID (not simulation)');
    drawKv(doc, 'Started', iso(experiment.startedAt || experiment.createdAt));
    drawKv(doc, 'Ended', iso(experiment.endedAt));
    drawKv(doc, 'Duration', (() => {
      const start = new Date(experiment.startedAt || experiment.createdAt).getTime();
      const end = new Date(experiment.endedAt || generatedAt).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 'unavailable';
      const mins = Math.round((end - start) / 60000);
      return `${mins} minutes`;
    })());
    drawKv(doc, 'Description', experiment.description || '—');
    drawKv(doc, 'Notes', experiment.notes || '—');

    drawSection(doc, '2. Test environment');
    drawKv(doc, 'Platform', 'Unrooted Android phones using Nearby Connections (P2P_CLUSTER)');
    drawKv(doc, 'Intended participants', experiment.participantCount);
    drawKv(doc, 'Registered devices', devices.length);
    drawKv(doc, 'App version (creator)', experiment.appVersion || 'unavailable');
    drawKv(doc, 'Data collection timestamp', iso(generatedAt));

    drawSection(doc, '3. Device information');
    if (!devices.length) {
      doc.font('Helvetica-Oblique').text('No devices registered.');
    } else {
      for (const d of devices) {
        doc.font('Helvetica-Bold').fontSize(9).text(`${d.role} · ${d.model || 'unknown model'}`);
        doc.font('Helvetica').fontSize(8).text(
          `deviceId=${d.deviceId}  meshUserId=${d.meshUserId}  ` +
            `Android ${d.androidVersion || '?'}  app ${d.appVersion || '?'}  ` +
            `clockOffsetMs=${fmt(d.clockOffsetMs)}  uncertaintyMs=${fmt(d.clockUncertaintyMs)}`
        );
        doc.moveDown(0.25);
      }
    }

    drawSection(doc, '4. Methodology');
    doc.fontSize(9).text(
      'Each trial records production mesh events (create, transmit, receive, forward, ACK, duplicate, hop-limit, cloud upload). ' +
        'A trial is successful only when the intended destination confirms receipt. Intermediate relays are not counted as delivery. ' +
        'Failed trials are retained. Private chat plaintext and emergency message bodies are never uploaded. ' +
        'End-to-end latency uses clock-offset-adjusted wall clocks; if uncertainty exceeds 1000 ms the latency is reported as unavailable.'
    );

    drawSection(doc, '5. Metric definitions');
    for (const [key, def] of Object.entries(METRIC_DEFINITIONS)) {
      doc.font('Helvetica-Bold').fontSize(8).text(key, { continued: false });
      doc.font('Helvetica').fontSize(8).text(def);
      doc.moveDown(0.2);
    }

    drawSection(doc, '6. Aggregate results');
    drawKv(doc, 'Total attempted trials', fmt(summary.totalTrialCount));
    drawKv(doc, 'Successful destination deliveries', fmt(summary.successfulDeliveries));
    drawKv(doc, 'Failed trials', fmt(summary.failedTrialCount));
    drawKv(doc, 'Skipped scenarios', fmt(summary.skippedTrialCount));
    drawKv(doc, 'Delivery ratio', fmtPct(summary.deliveryRatio));
    drawKv(doc, 'Average latency', fmtMs(summary.averageLatencyMs));
    drawKv(doc, 'Median latency', fmtMs(summary.medianLatencyMs));
    drawKv(doc, 'Latency samples (reliable only)', fmt(summary.latencySampleCount));
    drawKv(doc, 'Unreliable latency count', fmt(summary.unreliableLatencyCount));
    drawKv(doc, 'Average hop count', fmt(summary.averageHopCount));
    drawKv(doc, 'Duplicate suppression count', fmt(summary.duplicateSuppressionCount));
    drawKv(doc, 'Forwarding attempts', fmt(summary.forwardingAttempts));
    drawKv(doc, 'Routing overhead', fmt(summary.routingOverhead));
    drawKv(doc, 'Cloud relay success rate', fmtPct(summary.cloudRelaySuccessRate));
    drawKv(doc, 'Cloud relay succeeded / attempted', `${fmt(summary.cloudRelaySucceeded)} / ${fmt(summary.cloudRelayAttempted)}`);

    const scenarioRows = Object.entries(byScenario || {}).map(([label, s]) => ({
      label,
      deliveryRatio: s.deliveryRatio,
      averageLatencyMs: s.averageLatencyMs,
      averageHopCount: s.averageHopCount,
      successfulDeliveries: s.successfulDeliveries,
      failedTrialCount: s.failedTrialCount,
      duplicateSuppressionCount: s.duplicateSuppressionCount,
      cloudRelaySuccessRate: s.cloudRelaySuccessRate,
    }));

    drawSection(doc, '7. Charts (physical-device data only)');
    barChart(doc, 'Delivery ratio by scenario', scenarioRows, 'deliveryRatio', '%');
    barChart(doc, 'Average latency by scenario (reliable samples)', scenarioRows, 'averageLatencyMs', ' ms');
    barChart(doc, 'Average hop count by scenario', scenarioRows, 'averageHopCount');
    barChart(doc, 'Successful deliveries by scenario', scenarioRows, 'successfulDeliveries');
    barChart(doc, 'Failed deliveries by scenario', scenarioRows, 'failedTrialCount');
    barChart(doc, 'Duplicate suppression by scenario', scenarioRows, 'duplicateSuppressionCount');
    barChart(doc, 'Cloud relay success rate by scenario', scenarioRows, 'cloudRelaySuccessRate', '%');

    drawSection(doc, '8. Scenario-wise tables');
    for (const row of scenarioRows) {
      doc.font('Helvetica-Bold').fontSize(9).text(row.label);
      doc.font('Helvetica').fontSize(8).text(
        `delivery=${fmtPct(row.deliveryRatio)}  avgLatency=${fmtMs(row.averageLatencyMs)}  ` +
          `avgHops=${fmt(row.averageHopCount)}  ok=${fmt(row.successfulDeliveries)}  ` +
          `fail=${fmt(row.failedTrialCount)}  dup=${fmt(row.duplicateSuppressionCount)}  ` +
          `cloud=${fmtPct(row.cloudRelaySuccessRate)}`
      );
      doc.moveDown(0.3);
    }
    if (!scenarioRows.length) {
      doc.font('Helvetica-Oblique').text('No trial data uploaded yet.');
    }

    drawSection(doc, '9. Trial-level raw data');
    if (!trials.length) {
      doc.font('Helvetica-Oblique').text('No trials recorded.');
    } else {
      for (const t of trials) {
        if (doc.y > 720) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(8).text(`${t.trialId}`);
        doc.font('Helvetica').fontSize(7).text(
          `${t.scenario}  delivered=${t.delivered}  hops=${fmt(t.hopCount)}  ` +
            `latency=${t.latencyReliable ? fmtMs(t.latencyMs) : 'unavailable'}  ` +
            `dup=${t.duplicateCount}  fwd=${t.forwardingAttempts}  ` +
            `cloud=${t.cloudUploadStatus}  ack=${t.acknowledged}  ` +
            `sender=${t.senderDeviceId || '—'}  dest=${t.destinationDeviceId || t.destinationMeshUserId || '—'}  ` +
            `fail=${t.failureReason || '—'}  ` +
            `origSender=${t.originalSenderDeviceId || '—'}  ` +
            `relayUploader=${t.cloudUploaderDeviceId || '—'}`
        );
        doc.moveDown(0.15);
      }
    }

    drawSection(doc, '10. Measurement limitations');
    doc.fontSize(9).text(
      '• Physical Android device measurements only. Simulator / ONE / Python epidemic results are not mixed into this report.\n' +
        '• Cross-device latency requires measured clock offsets. When uncertainty exceeds 1000 ms, latency is unavailable.\n' +
        '• Routing overhead is (transmission attempts + forwards) / successful destination deliveries — application-specific, not an RFC standard.\n' +
        '• Cloud relay success requires a backend-confirmed upload, not merely relay reception.\n' +
        '• Private chat content is excluded. Emergency message bodies are excluded.\n' +
        '• Missing values are never replaced with zero.'
    );

    drawSection(doc, '11. Upload audit trail');
    if (!audits?.length) {
      doc.font('Helvetica-Oblique').text('No batch uploads recorded.');
    } else {
      for (const a of audits.slice(0, 20)) {
        doc.font('Helvetica').fontSize(8).text(
          `${iso(a.createdAt)} device=${a.deviceId} received=${a.receivedCount} ` +
            `inserted=${a.insertedCount} duplicates=${a.duplicateCount} rejected=${a.rejectedCount}`
        );
      }
    }

    doc.moveDown(1);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#555555').text(
      `Generated ${iso(generatedAt)} · filename EmergencyDTN_Experiment_Report_${dateStamp}.pdf`
    );

    doc.end();
  });
};

export const experimentReportFilename = (date = new Date()) => {
  const stamp = date.toISOString().slice(0, 10);
  return `EmergencyDTN_Experiment_Report_${stamp}.pdf`;
};
