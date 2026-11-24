import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const browser=await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(resolve('dist/dashboard.html')).href);
  await page.getByRole('heading',{name:'Federal accounts'}).waitFor();
  await page.getByRole('button',{name:'Renewal signals'}).click();
  await page.getByRole('heading',{name:'Recorded end dates'}).waitFor();
  await page.getByRole('button',{name:'Market overview'}).click();
  await page.getByRole('heading',{name:'Tracked supplier overview'}).waitFor();
  assert.deepEqual(errors,[],'Standalone application must load without browser errors.');
  console.log('Standalone build opens directly from disk; all three sections work.');
} finally {await browser.close();}
