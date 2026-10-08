import('./lib/generate-cli.mjs').then(module => module.generate()).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
