import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

// Serialize real Nodemailer messages in memory; never connect to SMTP.
const createTransport = nodemailer.createTransport.bind(nodemailer);
const memory = createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
let message, fail = false;
nodemailer.createTransport = () => ({
  async sendMail(options) {
    if (fail) throw new Error('private SMTP diagnostic with recipient@example.test');
    message = await memory.sendMail(options);
    return message;
  },
});
process.env.SMTP_HOST = 'smtp.example.test';
process.env.SMTP_USER = 'test';
process.env.SMTP_PASS = 'unit-test-placeholder';
const { sendMail } = await import('../lib/mailer.ts');

test('mailer works with patched Nodemailer and escapes plain-text HTML fallback', async () => {
  const result = await sendMail({ to: 'crew@example.test', subject: 'Order update', text: '<script>test</script>', html: '' });
  assert.equal(result.sent, true);
  const raw = message.message.toString().replace(/=\r?\n/g, '');
  assert.match(raw, /multipart\/alternative/);
  assert.match(raw, /&lt;script&gt;test&lt;\/script&gt;/);
});

test('mailer reports delivery failure without disclosing SMTP diagnostics', async () => {
  fail = true;
  const result = await sendMail({ to: 'crew@example.test', subject: 'Order update', text: 'Sample', html: '<p>Sample</p>' });
  assert.deepEqual(result, { sent: false, error: 'smtp_delivery_failed' });
});
