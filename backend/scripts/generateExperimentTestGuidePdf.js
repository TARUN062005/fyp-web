import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const outPath = path.resolve(
  'D:/finalyearproject/EmergencyDTN_Pin_To_Pin_Test_Guide.pdf'
);

const COLORS = {
  ink: '#111111',
  muted: '#333333',
  line: '#9ca3af',
  blue: '#1e40af',
  header: '#1e3a8a',
  headerText: '#ffffff',
  green: '#065f46',
  red: '#991b1b',
  box: '#eff6ff',
  value: '#fef3c7',
  phone: '#f8fafc',
  on: '#dcfce7',
  off: '#fee2e2',
  rowAlt: '#f3f4f6',
};

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 42, bottom: 48, left: 42, right: 42 },
  compress: false,
  info: {
    Title: 'EmergencyDTN — Pin-to-pin 7-test guide (exact field values)',
    Author: 'EmergencyDTN',
  },
});

const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

const left = () => doc.page.margins.left;
const contentWidth = () =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;

const resetFlow = (y) => {
  doc.x = left();
  if (typeof y === 'number') doc.y = y;
};

const ensureSpace = (h) => {
  if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    resetFlow(doc.page.margins.top);
  }
};

const fullText = (t, opts = {}) => {
  resetFlow();
  doc.text(t, left(), doc.y, {
    width: contentWidth(),
    align: opts.align || 'left',
    lineGap: opts.lineGap ?? 4,
  });
};

const h1 = (t) => {
  ensureSpace(40);
  doc.moveDown(0.15);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.ink);
  fullText(t, { lineGap: 3 });
  doc
    .moveTo(left(), doc.y + 4)
    .lineTo(left() + contentWidth(), doc.y + 4)
    .strokeColor(COLORS.blue)
    .lineWidth(2)
    .stroke();
  doc.moveDown(0.7);
  resetFlow();
};

const h2 = (t) => {
  ensureSpace(30);
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.blue);
  fullText(t, { lineGap: 2 });
  doc.moveDown(0.25);
  resetFlow();
};

const para = (t) => {
  resetFlow();
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.ink);
  fullText(t, { lineGap: 4 });
  doc.moveDown(0.35);
  resetFlow();
};

const step = (n, t) => {
  ensureSpace(28);
  resetFlow();
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink);
  fullText(`${n}.  ${t}`, { lineGap: 3 });
  doc.moveDown(0.12);
  resetFlow();
};

const callout = (title, lines) => {
  const innerW = contentWidth() - 20;
  doc.font('Helvetica-Bold').fontSize(12);
  const titleH = doc.heightOfString(title, { width: innerW, lineGap: 2 }) + 4;
  doc.font('Helvetica').fontSize(12);
  const lineHeights = lines.map(
    (line) => doc.heightOfString(line, { width: innerW, lineGap: 2 }) + 4
  );
  const h = 16 + titleH + lineHeights.reduce((a, b) => a + b, 0) + 10;
  ensureSpace(h + 8);
  const x = left();
  const y = doc.y;
  doc.roundedRect(x, y, contentWidth(), h, 6).fill(COLORS.box);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.blue)
    .text(title, x + 10, y + 8, { width: innerW, lineGap: 2 });
  let ty = y + 12 + titleH;
  lines.forEach((line, i) => {
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(COLORS.ink)
      .text(line, x + 10, ty, { width: innerW, lineGap: 2 });
    ty += lineHeights[i];
  });
  resetFlow(y + h + 10);
};

const fieldTable = (headers, rows) => {
  const colW = [
    contentWidth() * 0.32,
    contentWidth() * 0.38,
    contentWidth() * 0.3,
  ];
  const pad = 6;
  const rowMin = 28;

  const drawHeader = (y) => {
    doc.rect(left(), y, contentWidth(), 26).fill(COLORS.header);
    let x = left();
    headers.forEach((h, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(COLORS.headerText)
        .text(h, x + pad, y + 7, { width: colW[i] - pad * 2 });
      x += colW[i];
    });
    return y + 26;
  };

  ensureSpace(26 + rowMin);
  let y = drawHeader(doc.y);

  rows.forEach((row, idx) => {
    const heights = row.map((cell, i) => {
      doc.font(i === 1 ? 'Courier-Bold' : 'Helvetica').fontSize(11);
      return Math.max(
        rowMin,
        doc.heightOfString(String(cell), {
          width: colW[i] - pad * 2,
          lineGap: 2,
        }) + 12
      );
    });
    const h = Math.max(...heights);
    if (y + h > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      resetFlow(doc.page.margins.top);
      y = drawHeader(doc.y);
    }
    doc
      .rect(left(), y, contentWidth(), h)
      .fill(idx % 2 === 0 ? '#ffffff' : COLORS.rowAlt);
    doc
      .rect(left(), y, contentWidth(), h)
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .stroke();
    let x = left();
    row.forEach((cell, i) => {
      if (i === 1) {
        doc.rect(x, y, colW[i], h).fill(COLORS.value);
        doc
          .font('Courier-Bold')
          .fontSize(11)
          .fillColor(COLORS.red)
          .text(String(cell), x + pad, y + 7, {
            width: colW[i] - pad * 2,
            lineGap: 2,
          });
      } else {
        doc
          .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(11)
          .fillColor(COLORS.ink)
          .text(String(cell), x + pad, y + 7, {
            width: colW[i] - pad * 2,
            lineGap: 2,
          });
      }
      x += colW[i];
    });
    y += h;
  });
  resetFlow(y + 10);
};

const chip = (label, on, x, y) => {
  const w = 92;
  const h = 22;
  doc.roundedRect(x, y, w, h, 4).fill(on ? COLORS.on : COLORS.off);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(on ? COLORS.green : COLORS.red)
    .text(`${on ? 'ON' : 'OFF'}  ${label}`, x, y + 6, {
      width: w,
      align: 'center',
    });
};

const radios = (opts) => {
  ensureSpace(78);
  const x = left();
  const y = doc.y;
  doc
    .roundedRect(x, y, contentWidth(), 68, 6)
    .fill('#f9fafb')
    .strokeColor(COLORS.line)
    .lineWidth(0.8)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.ink)
    .text('Radios for this test', x + 10, y + 8);
  chip('Bluetooth', opts.bt, x + 10, y + 32);
  chip('Location', opts.loc, x + 110, y + 32);
  chip('Wi-Fi', opts.wifi, x + 210, y + 32);
  chip('Internet', opts.net, x + 310, y + 32);
  chip('Mobile data', opts.data ?? opts.net, x + 410, y + 32);
  resetFlow(y + 74);
  if (opts.note) {
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.muted);
    fullText(opts.note, { lineGap: 3 });
    doc.moveDown(0.25);
    resetFlow();
  }
};

const phoneRow = (phones) => {
  ensureSpace(70);
  const y = doc.y;
  const boxW = 110;
  const gap = 18;
  const total = phones.length * boxW + (phones.length - 1) * gap;
  let x = left() + Math.max(0, (contentWidth() - total) / 2);
  phones.forEach((p, i) => {
    doc
      .roundedRect(x, y, boxW, 52, 6)
      .fill(COLORS.phone)
      .strokeColor(COLORS.blue)
      .lineWidth(1.4)
      .stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLORS.blue)
      .text(p.title, x, y + 10, { width: boxW, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(p.sub, x + 4, y + 28, { width: boxW - 8, align: 'center' });
    if (i < phones.length - 1) {
      const ax1 = x + boxW + 2;
      const ax2 = x + boxW + gap - 2;
      const ay = y + 26;
      doc.strokeColor(COLORS.blue).lineWidth(1.6).moveTo(ax1, ay).lineTo(ax2, ay).stroke();
      doc
        .fillColor(COLORS.blue)
        .polygon([ax2, ay], [ax2 - 7, ay - 4], [ax2 - 7, ay + 4])
        .fill();
    }
    x += boxW + gap;
  });
  resetFlow(y + 62);
};

const footer = () => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#4b5563')
      .text(
        'EmergencyDTN pin-to-pin test guide  |  Use the yellow column exactly as typed',
        left(),
        doc.page.height - 34,
        { width: contentWidth() - 50, lineGap: 1 }
      );
    doc.text(
      `Page ${i + 1} of ${range.count}`,
      left() + contentWidth() - 80,
      doc.page.height - 34,
      { width: 80, align: 'right' }
    );
  }
};

// ---------------------------------------------------------------------------
// COVER + APP MAP
// ---------------------------------------------------------------------------
doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.ink);
fullText('EmergencyDTN pin-to-pin test guide', { lineGap: 3 });
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(13).fillColor(COLORS.muted);
fullText('Exact screen names, field labels, and values to type for all 7 tests.');
doc.moveDown(0.8);
resetFlow();

callout('How to read this PDF', [
  'Yellow boxes = type this text exactly (copy it, do not invent your own).',
  'Tap / note column = the exact button or chip already in the app.',
  'Bottom bar labels are Home, Chat, Alerts, SOS, Settings.',
  'The Alerts tab opens a screen whose title is Broadcast.',
]);

h1('1. Where every screen is');
para(
  'After you sign in, the five tabs at the bottom of the app are always visible. Use these names — they match the app, not research paper wording.'
);

fieldTable(
  ['Where you tap', 'What you see', 'Use it for'],
  [
    ['Bottom tab Home', 'Home', 'Not used in these tests'],
    ['Bottom tab Chat', 'Screen title: Mesh chat', 'Test 2 private chat'],
    ['Bottom tab Alerts', 'Screen title: Broadcast', 'Tests 1, 3, 4, 5, 7'],
    ['Bottom tab SOS', 'Screen title: Emergency', 'Test 6 cloud SOS'],
    ['Bottom tab Settings', 'Settings', 'Copy User ID + open experiments'],
  ]
);

h2('Open Experiment Testing');
step(1, 'Tap bottom tab Settings.');
step(2, 'Scroll to the card titled Experiment Testing.');
step(3, 'Tap the button Open Experiment Testing.');
step(4, 'The next screen title is Experiment Testing.');

h2('Copy the receiver User ID (needed on every test)');
step(1, 'On the RECEIVER phone only, tap Settings.');
step(2, 'On the Profile card, find the row labelled User ID.');
step(3, 'Long-press that long hex string and Copy.');
step(4, 'That same value is also shown later as Mesh user ID on Experiment Testing  >  Device Information.');
para(
  'Paste it later into Destination mesh user ID on the SENDER phone. Relays must leave that field empty or unused.'
);

h1('2. Exact fields on Experiment Testing');
para(
  'The create form is the card Start New Experiment. Fill it once per test on Phone A (the sender). Then share Join code with the other phones.'
);

h2('Create form — field names as printed in the app');
fieldTable(
  ['App field label', 'Type / choose this', 'Then'],
  [
    ['Experiment name', '(see each test page)', 'Required'],
    ['Test scenario', '(dropdown — exact labels below)', 'Tap the field to open the list'],
    ['Participating devices (2–4 typical)', '2 or 3 or 4', 'Number of phones you will use'],
    ['Test description', '(see each test page)', 'Short sentence'],
    ['Notes (optional)', '(leave empty)', 'Do not type anything'],
    ["This phone's role", 'SENDER', 'On Phone A only'],
    ['Create experiment button', '—', 'Tap Create experiment'],
  ]
);

h2('Test scenario dropdown — exact list in the app');
para(
  'Tap Test scenario. The menu items are exactly: Direct Broadcast, Private Chat, Three-Phone Line, Four-Phone Line, Duplicate Suppression, Offline Sender to Internet Relay, Hop Limit.'
);

h2('This phone\'s role dropdown — exact list in the app');
para('The menu items are exactly: SENDER, RELAY, RECEIVER, GATEWAY. Pick one role per phone.');

h2('Join form — on every other phone');
fieldTable(
  ['App field label', 'Type / choose this', 'Then'],
  [
    ['Join code', '(copy from Phone A Active Experiment card)', 'Same code on every phone'],
    ["This phone's role", 'RECEIVER or RELAY or GATEWAY', 'See the test page'],
    ['Join with code button', '—', 'Tap Join with code'],
  ]
);

h2('Run a trial card');
fieldTable(
  ['App field label', 'Type / choose this', 'Then'],
  [
    ['Destination mesh user ID', '(paste receiver User ID)', 'Sender phone only'],
    ['Start trial button', '—', 'Tap Start trial BEFORE sending the message'],
    ['Stop trial (keep as failed)', '—', 'Only if the message never arrives'],
    ['Skip this scenario', '—', 'If you do not have enough phones'],
    ['Upload now', '—', 'After the test, when internet is on'],
  ]
);

h1('3. Exact fields on Broadcast (Alerts tab)');
para(
  'Bottom tab Alerts opens screen title Broadcast. Scroll to the section New broadcast. These are the real composer fields.'
);

fieldTable(
  ['App field / chip row', 'Exact options in the app', 'What you tap'],
  [
    ['Message box placeholder', 'Emergency broadcast message', 'Type into this box'],
    ['Emergency type row', 'SOS | Fire | Flood | Medical | Collapse | Structural collapse | Other', 'Tap one chip'],
    ['Severity row', 'Low | Medium | High | Critical', 'Tap one chip'],
    ['Send button (not Critical)', 'Send broadcast', 'Use this for Tests 1, 3, 4, 5, 7'],
    ['Send button (Critical)', 'Send distress', 'Do not use unless Test 6'],
  ]
);

callout('Broadcast rule used in these tests', [
  'Always tap Emergency type = Other.',
  'Always tap Severity = Medium. That keeps the button labelled Send broadcast.',
  'Do not tap Critical. Critical changes the button to Send distress and may start SOS upload.',
]);

h1('4. Exact fields on Chat and SOS');
h2('Private chat (bottom tab Chat)');
fieldTable(
  ['App label', 'Type / choose this', 'Then'],
  [
    ['Screen title', 'Mesh chat', 'Already open after Chat tab'],
    ['Start chat with selected node', '—', 'Tap this button'],
    ['Sheet title', 'Start chat', 'Opens a list of nearby phones'],
    ['Search field', '(leave empty)', 'Placeholder: Search name, Node ID, Emergency ID…'],
    ['Currently Online list', '(tap the other phone name)', 'Must show the receiver'],
    ['Message box placeholder', 'Type a message', 'Type the test sentence'],
    ['Send icon', '—', 'Paper-plane button on the right'],
  ]
);

h2('SOS (bottom tab SOS) — Test 6 only');
fieldTable(
  ['App label', 'Type / choose this', 'Then'],
  [
    ['Screen title', 'Emergency', 'Already open after SOS tab'],
    ['Helper text', 'Hold readiness — tap SOS to send distress', 'Do not type here'],
    ['Big round button', 'SOS', 'Tap once, wait for countdown'],
    ['App-filled message', 'EMERGENCY DISTRESS — needs assistance', 'You do not type this; the app sends it'],
    ['Retry SOS', '—', 'Only if the screen shows Send failed'],
  ]
);

h1('5. One-time setup on every phone');
step(1, 'Install the same EmergencyDTN APK and sign in with Google on each phone.');
step(2, 'Turn Bluetooth ON.');
step(3, 'Turn Location ON. Allow Nearby / location permission when the app asks.');
step(4, 'Turn Wi-Fi ON, or turn on a mobile hotspot. Nearby needs Wi-Fi or hotspot even with no internet.');
step(5, 'Keep the app open in the foreground on every phone.');
step(6, 'Confirm the other phone appears under Chat  >  Start chat with selected node  >  Currently Online before you start a trial.');
para(
  'If Currently Online is empty, do not start the trial. Stay on the same room, unlock both screens, and wait until the name appears.'
);

doc.addPage();
h1('TEST 1 — Direct Broadcast  (2 phones)');
phoneRow([
  { title: 'Phone A', sub: 'role SENDER' },
  { title: 'Phone B', sub: 'role RECEIVER' },
]);
radios({
  bt: true,
  loc: true,
  wifi: true,
  net: false,
  note: 'Internet can be off. Nearby still needs Bluetooth + Location + (Wi-Fi or hotspot).',
});

h2('Phone A — create the experiment');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Experiment name', 'Lab Test 1 Direct', 'Start New Experiment card'],
    ['Test scenario', 'Direct Broadcast', 'First item in the dropdown'],
    ['Participating devices (2–4 typical)', '2', 'Number two'],
    ['Test description', 'Two phone direct broadcast', 'One line'],
    ['Notes (optional)', '(leave empty)', 'Skip this field'],
    ["This phone's role", 'SENDER', 'Dropdown'],
    ['Create experiment', '—', 'Tap Create experiment'],
  ]
);
para(
  'After create, the Active Experiment card shows Join code. Read that code to Phone B (or type it on Phone B).'
);

h2('Phone B — join');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Join code', '(Phone A join code)', 'Join experiment card'],
    ["This phone's role", 'RECEIVER', 'Dropdown'],
    ['Join with code', '—', 'Tap Join with code'],
  ]
);

h2('Copy destination, then start trial, then send');
step(1, 'On Phone B: Settings  >  Profile  >  copy User ID.');
step(2, 'On Phone A: Experiment Testing  >  Run a trial  >  paste into Destination mesh user ID.');
step(3, 'On Phone A tap Start trial. Wait until the screen shows a running trial.');
step(4, 'On Phone A tap bottom tab Alerts (screen title becomes Broadcast).');
step(5, 'Scroll to New broadcast and fill the composer exactly as below.');

fieldTable(
  ['Broadcast field', 'Type / tap this exact value', 'Must be'],
  [
    ['Emergency broadcast message', 'EXP-T1-DIRECT', 'Type this, all caps'],
    ['Emergency type', 'Other', 'Last chip in the type row'],
    ['Severity', 'Medium', 'Do not tap Critical'],
    ['Send button', 'Send broadcast', 'Tap once'],
  ]
);

step(6, 'On Phone B stay on Alerts. The card with EXP-T1-DIRECT should appear.');
step(7, 'Go back to Experiment Testing on both phones. Failed trials stay recorded. Then tap Upload now when internet is on.');

doc.addPage();
h1('TEST 2 — Private Chat  (2 phones)');
phoneRow([
  { title: 'Phone A', sub: 'role SENDER' },
  { title: 'Phone B', sub: 'role RECEIVER' },
]);
radios({
  bt: true,
  loc: true,
  wifi: true,
  net: false,
  note: 'Same radios as Test 1. Chat body is never uploaded — only delivery events.',
});

h2('Phone A — create');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Experiment name', 'Lab Test 2 Chat', 'Start New Experiment'],
    ['Test scenario', 'Private Chat', 'Second dropdown item'],
    ['Participating devices (2–4 typical)', '2', 'Number two'],
    ['Test description', 'Two phone private chat', 'One line'],
    ['Notes (optional)', '(leave empty)', 'Skip'],
    ["This phone's role", 'SENDER', 'Dropdown'],
    ['Create experiment', '—', 'Tap Create experiment'],
  ]
);

h2('Phone B — join');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Join code', '(Phone A join code)', 'Join experiment card'],
    ["This phone's role", 'RECEIVER', 'Dropdown'],
    ['Join with code', '—', 'Tap Join with code'],
  ]
);

h2('Start trial, then send the chat');
step(1, 'Paste Phone B User ID into Phone A Destination mesh user ID.');
step(2, 'On Phone A tap Start trial.');
step(3, 'On Phone A tap bottom tab Chat. Screen title is Mesh chat.');
step(4, 'Tap Start chat with selected node.');
step(5, 'On the Start chat sheet, under Currently Online, tap Phone B\'s display name.');
step(6, 'Fill the composer exactly as below.');

fieldTable(
  ['Chat field', 'Type / tap this exact value', 'Must be'],
  [
    ['Type a message', 'EXP-T2-CHAT', 'Type this, all caps'],
    ['Send', 'paper-plane icon', 'Tap the send icon on the right'],
  ]
);

step(7, 'On Phone B open the same conversation. EXP-T2-CHAT should show in a bubble.');
step(8, 'Return to Experiment Testing and later tap Upload now.');

doc.addPage();
h1('TEST 3 — Three-Phone Line  (3 phones)');
phoneRow([
  { title: 'Phone A', sub: 'SENDER' },
  { title: 'Phone B', sub: 'RELAY' },
  { title: 'Phone C', sub: 'RECEIVER' },
]);
para(
  'Stand in a line: A near B, B near C, A far from C so A cannot talk to C directly. If you only have 2 phones, tap Skip this scenario instead of sending.'
);
radios({
  bt: true,
  loc: true,
  wifi: true,
  net: false,
  note: 'Keep all three phones unlocked with the app open.',
});

h2('Phone A — create');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Experiment name', 'Lab Test 3 Line', 'Start New Experiment'],
    ['Test scenario', 'Three-Phone Line', 'Dropdown'],
    ['Participating devices (2–4 typical)', '3', 'Number three'],
    ['Test description', 'A to B to C line broadcast', 'One line'],
    ['Notes (optional)', '(leave empty)', 'Skip'],
    ["This phone's role", 'SENDER', 'Phone A'],
    ['Create experiment', '—', 'Tap Create experiment'],
  ]
);

h2('Phones B and C — join');
fieldTable(
  ['Phone', 'This phone\'s role', 'Join code'],
  [
    ['Phone B', 'RELAY', '(same join code as A)'],
    ['Phone C', 'RECEIVER', '(same join code as A)'],
  ]
);

h2('Trial + broadcast to send');
step(1, 'Copy Phone C Settings  >  Profile  >  User ID.');
step(2, 'On Phone A paste it into Destination mesh user ID. Do not paste Phone B.');
step(3, 'On Phone A tap Start trial.');
step(4, 'On Phone A: Alerts  >  New broadcast, then fill:');

fieldTable(
  ['Broadcast field', 'Type / tap this exact value', 'Must be'],
  [
    ['Emergency broadcast message', 'EXP-T3-LINE', 'All caps'],
    ['Emergency type', 'Other', 'Chip'],
    ['Severity', 'Medium', 'Chip'],
    ['Send button', 'Send broadcast', 'Tap once'],
  ]
);

step(5, 'Watch Phone C Alerts for EXP-T3-LINE. Phone B is only a hop, not the destination.');

doc.addPage();
h1('TEST 4 — Four-Phone Line  (4 phones)');
phoneRow([
  { title: 'A SENDER', sub: 'start' },
  { title: 'B RELAY', sub: 'hop 1' },
  { title: 'C RELAY', sub: 'hop 2' },
  { title: 'D RECEIVER', sub: 'end' },
]);
para(
  'Line up A–B–C–D. Neighbours close, ends far apart. With fewer than 4 phones tap Skip this scenario on the sender after creating/joining.'
);
radios({ bt: true, loc: true, wifi: true, net: false });

h2('Phone A — create');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Experiment name', 'Lab Test 4 Line', 'Start New Experiment'],
    ['Test scenario', 'Four-Phone Line', 'Dropdown'],
    ['Participating devices (2–4 typical)', '4', 'Number four'],
    ['Test description', 'A B C D line broadcast', 'One line'],
    ['Notes (optional)', '(leave empty)', 'Skip'],
    ["This phone's role", 'SENDER', 'Phone A'],
    ['Create experiment', '—', 'Tap Create experiment'],
  ]
);

h2('Other phones — join');
fieldTable(
  ['Phone', 'This phone\'s role', 'Join code'],
  [
    ['Phone B', 'RELAY', '(same join code)'],
    ['Phone C', 'RELAY', '(same join code)'],
    ['Phone D', 'RECEIVER', '(same join code)'],
  ]
);

step(1, 'Destination mesh user ID = Phone D User ID only.');
step(2, 'Phone A tap Start trial.');
step(3, 'Phone A Alerts  >  New broadcast:');

fieldTable(
  ['Broadcast field', 'Type / tap this exact value', 'Must be'],
  [
    ['Emergency broadcast message', 'EXP-T4-LINE', 'All caps'],
    ['Emergency type', 'Other', 'Chip'],
    ['Severity', 'Medium', 'Chip'],
    ['Send button', 'Send broadcast', 'Tap once'],
  ]
);

doc.addPage();
h1('TEST 5 — Duplicate Suppression  (3 phones)');
para(
  'Place A, B, and C in a triangle so every phone can hear every other phone. The same broadcast should be forwarded more than once; the app records duplicate detection. Destination is still Phone C.'
);
radios({ bt: true, loc: true, wifi: true, net: false });

h2('Phone A — create');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Experiment name', 'Lab Test 5 Duplicate', 'Start New Experiment'],
    ['Test scenario', 'Duplicate Suppression', 'Dropdown'],
    ['Participating devices (2–4 typical)', '3', 'Number three'],
    ['Test description', 'Triangle duplicate suppression', 'One line'],
    ['Notes (optional)', '(leave empty)', 'Skip'],
    ["This phone's role", 'SENDER', 'Phone A'],
    ['Create experiment', '—', 'Tap Create experiment'],
  ]
);

h2('Join roles');
fieldTable(
  ['Phone', 'This phone\'s role', 'Join code'],
  [
    ['Phone B', 'RELAY', '(same join code)'],
    ['Phone C', 'RECEIVER', '(same join code)'],
  ]
);

step(1, 'Destination mesh user ID = Phone C User ID.');
step(2, 'Phone A tap Start trial.');
step(3, 'Phone A Alerts  >  New broadcast:');

fieldTable(
  ['Broadcast field', 'Type / tap this exact value', 'Must be'],
  [
    ['Emergency broadcast message', 'EXP-T5-DUP', 'All caps'],
    ['Emergency type', 'Other', 'Chip'],
    ['Severity', 'Medium', 'Chip'],
    ['Send button', 'Send broadcast', 'Tap once'],
  ]
);

step(4, 'Do not send a second message. One Send broadcast is enough.');

doc.addPage();
h1('TEST 6 — Offline Sender to Internet Relay  (2 phones)');
phoneRow([
  { title: 'Phone A', sub: 'SENDER  no internet' },
  { title: 'Phone B', sub: 'GATEWAY  has internet' },
]);
radios({
  bt: true,
  loc: true,
  wifi: true,
  net: false,
  data: false,
  note: 'Phone A: turn Mobile data OFF and do not use Wi-Fi internet. Phone B: turn Mobile data or Wi-Fi internet ON. Both still need Bluetooth + Location + (Wi-Fi radio or hotspot) for Nearby.',
});

h2('Phone A — create');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Experiment name', 'Lab Test 6 Cloud', 'Start New Experiment'],
    ['Test scenario', 'Offline Sender to Internet Relay', 'Dropdown'],
    ['Participating devices (2–4 typical)', '2', 'Number two'],
    ['Test description', 'Offline SOS via gateway phone', 'One line'],
    ['Notes (optional)', '(leave empty)', 'Skip'],
    ["This phone's role", 'SENDER', 'Phone A'],
    ['Create experiment', '—', 'Tap Create experiment'],
  ]
);

h2('Phone B — join as gateway');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Join code', '(Phone A join code)', 'Join experiment'],
    ["This phone's role", 'GATEWAY', 'Not RECEIVER this time'],
    ['Join with code', '—', 'Tap Join with code'],
  ]
);

h2('Start trial, then send SOS — do not type a custom message');
step(1, 'Destination mesh user ID = Phone B User ID.');
step(2, 'Phone A tap Start trial.');
step(3, 'On Phone A tap bottom tab SOS. Screen title is Emergency.');
step(4, 'Read the line Hold readiness — tap SOS to send distress.');
step(5, 'Tap the big round SOS button once. Wait through the countdown. Do not type any text.');

fieldTable(
  ['SOS item', 'Exact value the app uses', 'You type?'],
  [
    ['Button label', 'SOS', 'Tap, do not type'],
    ['Message the app sends', 'EMERGENCY DISTRESS — needs assistance', 'No — filled by the app'],
    ['Emergency type used internally', 'SOS', 'No extra chip to tap on this screen'],
  ]
);

para(
  'Do not use Alerts for Test 6. If you accidentally open Broadcast, do not tap Send distress. Stay on the SOS tab.'
);
step(6, 'Phone B should receive the distress over Nearby. Phone B has internet so cloud metadata can upload.');
step(7, 'When Phone A later gets internet, open Experiment Testing and tap Upload now for local experiment events.');

doc.addPage();
h1('TEST 7 — Hop Limit  (as many phones as you have)');
para(
  'Production hop limit is 5. Do not change any setting. If you cannot make a long path, create the experiment then tap Skip this scenario. That skip is a valid recorded result.'
);
radios({ bt: true, loc: true, wifi: true, net: false });

h2('Phone A — create');
fieldTable(
  ['Field on screen', 'Type this exact value', 'Tap / note'],
  [
    ['Experiment name', 'Lab Test 7 Hops', 'Start New Experiment'],
    ['Test scenario', 'Hop Limit', 'Last dropdown item'],
    ['Participating devices (2–4 typical)', '2', 'Or 3 / 4 if you have them'],
    ['Test description', 'Record production hop limit', 'One line'],
    ['Notes (optional)', '(leave empty)', 'Skip'],
    ["This phone's role", 'SENDER', 'Phone A'],
    ['Create experiment', '—', 'Tap Create experiment'],
  ]
);

h2('If you CAN form a line');
para(
  'Middle phones join as RELAY. Last phone joins as RECEIVER. Destination mesh user ID = last phone User ID. Start trial, then send:'
);
fieldTable(
  ['Broadcast field', 'Type / tap this exact value', 'Must be'],
  [
    ['Emergency broadcast message', 'EXP-T7-HOPS', 'All caps'],
    ['Emergency type', 'Other', 'Chip'],
    ['Severity', 'Medium', 'Chip'],
    ['Send button', 'Send broadcast', 'Tap once'],
  ]
);

h2('If you CANNOT form a long path (typical with 2 phones)');
step(1, 'Still create Lab Test 7 Hops as above.');
step(2, 'On Phone A, on the Run a trial card, tap Skip this scenario.');
step(3, 'Do not send EXP-T7-HOPS in that case.');

doc.addPage();
h1('6. After every test — same 4 taps');
step(1, 'Open Experiment Testing again (Settings  >  Open Experiment Testing).');
step(2, 'On View Experiment Results, confirm a trial row exists. Failed is still valid. Do not delete it.');
step(3, 'If Running trial is still showing after 1–2 minutes, tap Stop trial (keep as failed).');
step(4, 'Turn internet ON, then tap Upload now. Watch Pending go down.');

callout('Do not type or send anything extra', [
  'Do not send a second broadcast for the same trial.',
  'Do not type a different sentence than EXP-T1-DIRECT / EXP-T2-CHAT / etc.',
  'Do not put chat text, names, or SOS body into Notes (optional).',
  'Private chat content is never uploaded. Experiment events are.',
]);

h1('7. Website PDF after upload');
step(1, 'On a computer open the admin site (local: http://localhost:5173/ ).');
step(2, 'Sign in as admin.');
step(3, 'Open Experiment Analytics.');
step(4, 'Open the experiment that matches the name you typed (Lab Test 1 Direct, and so on).');
step(5, 'Download the IEEE-style results PDF from that page.');
para(
  'If the website list is empty, upload has not reached this backend yet. The phones must tap Upload now while they can reach the same API the website uses.'
);

h1('8. Quick copy sheet — every message to type');
fieldTable(
  ['Test', 'Type this exact text', 'Where you type it'],
  [
    ['1 Direct Broadcast', 'EXP-T1-DIRECT', 'Alerts  >  New broadcast message box'],
    ['2 Private Chat', 'EXP-T2-CHAT', 'Chat  >  Type a message box'],
    ['3 Three-Phone Line', 'EXP-T3-LINE', 'Alerts  >  New broadcast message box'],
    ['4 Four-Phone Line', 'EXP-T4-LINE', 'Alerts  >  New broadcast message box'],
    ['5 Duplicate Suppression', 'EXP-T5-DUP', 'Alerts  >  New broadcast message box'],
    ['6 Cloud relay SOS', '(do not type)', 'SOS tab  >  tap SOS; app sends distress'],
    ['7 Hop Limit', 'EXP-T7-HOPS', 'Alerts  >  New broadcast, or Skip this scenario'],
  ]
);

h2('Broadcast chips used in Tests 1, 3, 4, 5, 7 (always the same)');
fieldTable(
  ['Chip row', 'Tap this one', 'Do not tap'],
  [
    ['Emergency type', 'Other', 'SOS, Fire, Flood, Medical, Collapse, Structural collapse'],
    ['Severity', 'Medium', 'Low, High, Critical'],
    ['Button', 'Send broadcast', 'Send distress'],
  ]
);

h2('Experiment names to type');
fieldTable(
  ['Test', 'Experiment name field', 'Test scenario dropdown'],
  [
    ['1', 'Lab Test 1 Direct', 'Direct Broadcast'],
    ['2', 'Lab Test 2 Chat', 'Private Chat'],
    ['3', 'Lab Test 3 Line', 'Three-Phone Line'],
    ['4', 'Lab Test 4 Line', 'Four-Phone Line'],
    ['5', 'Lab Test 5 Duplicate', 'Duplicate Suppression'],
    ['6', 'Lab Test 6 Cloud', 'Offline Sender to Internet Relay'],
    ['7', 'Lab Test 7 Hops', 'Hop Limit'],
  ]
);

doc.flushPages();
footer();
doc.end();

stream.on('finish', () => {
  const bytes = fs.statSync(outPath).size;
  process.stdout.write(`Wrote ${outPath} (${bytes} bytes)\n`);
});
