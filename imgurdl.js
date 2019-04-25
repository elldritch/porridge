const path = require('path');
const request = require('request-promise');
const download = require('download');
const mkdirp = require('mkdirp-promise');
const ora = require('ora');
const progress = require('cli-progress');

// Parse user input flags.
const argv = require('yargs')
  .usage('$0 downloads all images submitted by a user prints metadata.')
  .option('user', {
    desc: 'target user',
    type: 'string',
    demandOption: true
  })
  .option('client-id', {
    desc: 'Imgur API client ID',
    type: 'string',
    demandOption: true
  })
  .option('dir', {
    desc: 'image output directory',
    default: './images',
    type: 'string',
    demandOption: true
  }).argv;

// Use async/await in main entrypoint.
async function main() {
  let page = 0;
  let submissions = [];

  // While pages are non-empty, go to the next page.
  let spinner = ora();
  while (true) {
    spinner.start(
      `Downloading user submission metadata for ${argv.user} (page ${page +
        1})...`
    );
    const res = await request({
      uri: `https://api.imgur.com/3/account/${
        argv.user
      }/submissions/${page}/oldest`,
      headers: {
        Authorization: `Client-ID ${argv.clientId}`
      },
      json: true
    });

    if (res.data.length == 0) {
      break;
    }

    submissions = submissions.concat(res.data);
    page++;
  }
  spinner.succeed();

  // Save submissions.
  await mkdirp(argv.dir);
  let promises = [];
  let bar = new progress.Bar({
    format: `  Downloading submissions [{bar}] {value}/{total} {percentage}% {eta}s`,
    total: submissions.length
  });
  bar.start(submissions.length, 0);
  submissions.forEach(submission => {
    if (submission.is_album) {
      const albumPath = path.join(argv.dir, submission.id);
      promises.push(
        mkdirp(albumPath).then(() =>
          Promise.all(
            submission.images.map(image => download(image.link, albumPath))
          ).then(() => bar.increment(1))
        )
      );
    } else {
      promises.push(
        download(submission.link, argv.dir).then(() => bar.increment(1))
      );
    }
  });
  await Promise.all(promises)
  bar.stop();

  // Print metadata.
  console.log(JSON.stringify(submissions));
}

main();
