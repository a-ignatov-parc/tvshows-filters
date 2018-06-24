const fs = require('fs');

const Listr = require('listr');
const fetch = require('node-fetch');

const symbolsRegex = /[^a-z0-9]+/gi;

function unifyTitle(title) {
  return title
    .toLowerCase()
    .replace(symbolsRegex, '');
}

function fetchJSON(url) {
  return fetch(url).then(response => response.json());
}

const tasks = new Listr([
  {
    title: 'Fetch api data',
    task: () => {
      return new Listr([
        {
          title: 'Fetch soap api',
          task: ctx => fetchJSON('https://api.soap4.me/v2/soap/').then(result => ctx.soap = result),
        },
        {
          title: 'Fetch amediateka api',
          task: ctx => fetchJSON('https://api.amediateka.ru/v1/serials.json?client_id=amediateka&limit=1000').then(result => {
            if (!result.serials) {
              throw new Error(result.meta.error_message);
            }
            ctx.amediateka = result;
          }),
        },
      ], {
        concurrent: true,
      });
    },
  },
  {
    title: 'Search for intersections',
    task: ctx => {
      const { soap, amediateka } = ctx;
      ctx.intersections = amediateka.serials
        .map(serial => serial.original_name.trim())
        .reduce((result, name) => {
          const title = unifyTitle(name);
          const soapSerial = soap.find(item => unifyTitle(item.title) === title);
          if (soapSerial) result.push(soapSerial);
          return result;
        }, []);
    },
  },
  {
    title: 'Save information',
    task: ({ intersections }, task) => {
      const ids = intersections.map(({ sid }) => sid);
      const titles = intersections.map(({ title }) => title);
      const payload = intersections.map(({ sid, title }) => ({ sid, title }));

      fs.writeFileSync('dist/ids.json', JSON.stringify(ids));
      fs.writeFileSync('dist/titles.json', JSON.stringify(titles));
      fs.writeFileSync('dist/payload.json', JSON.stringify(payload));

      task.title += ` (${intersections.length} items found)`;
    },
  },
]);

tasks
  .run()
  .catch(err => console.error(err));
