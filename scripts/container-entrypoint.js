// Optional SSH entrypoint: keep both the web server and SSH server supervised.
// Runs as the existing unprivileged blog user; SSH only accepts public keys.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const home = process.env.HOME || '/home/blog';
const sshDir = path.join(home, '.ssh');
fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
fs.chmodSync(sshDir, 0o700);
const authorizedKeys = fs.readFileSync('/run/blog-authorized_keys', 'utf8').trim();
if (!authorizedKeys || !authorizedKeys.split('\n').every(line => /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+)\s+[A-Za-z0-9+/=]+(?:\s.*)?$/.test(line))) {
  throw new Error('Provide valid Mac SSH public keys before enabling remote access');
}
fs.writeFileSync(path.join(sshDir, 'authorized_keys'), `${authorizedKeys}\n`, { mode: 0o600 });
fs.chmodSync(path.join(sshDir, 'authorized_keys'), 0o600);
const hostKey = path.join(sshDir, 'host_ed25519');
if (!fs.existsSync(hostKey)) {
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', hostKey], { stdio: 'inherit' });
}
const sshConfig = path.join(sshDir, 'sshd_config');
fs.writeFileSync(sshConfig, [
  'Port 2222',
  'ListenAddress 0.0.0.0',
  `HostKey ${hostKey}`,
  `PidFile ${sshDir}/sshd.pid`,
  `AuthorizedKeysFile ${sshDir}/authorized_keys`,
  'AllowUsers blog',
  'PermitRootLogin no',
  'PubkeyAuthentication yes',
  'PasswordAuthentication no',
  'KbdInteractiveAuthentication no',
  'UsePAM no',
  'StrictModes yes',
  'UseDNS no',
  'AllowTcpForwarding local',
  'PermitOpen 127.0.0.1:* localhost:*',
  'GatewayPorts no',
  'Subsystem sftp internal-sftp',
  'LogLevel INFO',
  '',
].join('\n'), { mode: 0o600 });
execFileSync('/usr/sbin/sshd', ['-t', '-f', sshConfig], { stdio: 'inherit' });

const children = [
  spawn('/usr/sbin/sshd', ['-D', '-e', '-f', sshConfig], { stdio: 'inherit' }),
  spawn(process.execPath, ['preview-server.js'], { stdio: 'inherit', cwd: '/app' }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 5000).unref();
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`Container service exited: ${code ?? signal}`);
      stop(code || 1);
    }
  });
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
