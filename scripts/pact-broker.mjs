import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const command = process.argv[2];
const broker = required('PACT_BROKER_URL').replace(/\/$/, '');
const version = process.env.GITHUB_SHA || process.env.GIT_SHA || 'local';
const prodTag = process.env.PACT_TAG || 'prod';

function required(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

function headers(extra = {}) {
    const result = { ...extra };
    if (process.env.PACT_BROKER_TOKEN) {
        result.Authorization = `Bearer ${process.env.PACT_BROKER_TOKEN}`;
    }
    return result;
}

async function publish() {
    const dir = join(process.cwd(), 'pacts');
    const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
    if (files.length === 0) {
        throw new Error(`no pact files in ${dir}`);
    }
    for (const file of files) {
        const pact = JSON.parse(await readFile(join(dir, file), 'utf8'));
        const consumer = pact.consumer?.name;
        const provider = pact.provider?.name;
        if (!consumer || !provider) {
            throw new Error(`${file} is missing consumer/provider names`);
        }
        const url = `${broker}/pacts/provider/${encodeURIComponent(provider)}/consumer/${encodeURIComponent(consumer)}/version/${encodeURIComponent(version)}`;
        const res = await fetch(url, {
            method: 'PUT',
            headers: headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(pact),
        });
        if (!res.ok) {
            throw new Error(`publish ${file} failed: ${res.status} ${await res.text()}`);
        }
        console.log(`published ${consumer} -> ${provider} @ ${version} (${res.status})`);
    }
}

async function tagPacticipant(name) {
    const url = `${broker}/pacticipants/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}/tags/${encodeURIComponent(prodTag)}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: '{}',
    });
    if (!res.ok) {
        throw new Error(`tag ${name} failed: ${res.status} ${await res.text()}`);
    }
    console.log(`tagged ${name} ${version} as ${prodTag} (${res.status})`);
}

async function applyProdTag() {
    await tagPacticipant('MiniBnB');
}

async function canIDeploy() {
    const participant = process.argv[3] || 'MiniBnBWeb';
    const url = `${broker}/can-i-deploy?pacticipant=${encodeURIComponent(participant)}&version=${encodeURIComponent(version)}&to=${encodeURIComponent(prodTag)}`;
    const res = await fetch(url, { headers: headers() });
    const body = await res.text();
    console.log(body);
    const json = JSON.parse(body);
    const deployable = json.summary?.deployable ?? json.deployable;
    if (deployable !== true) {
        process.exit(1);
    }
}

const commands = { publish, tag: applyProdTag, 'can-i-deploy': canIDeploy };
const run = commands[command];
if (!run) {
    throw new Error('usage: node scripts/pact-broker.mjs publish|tag|can-i-deploy [pacticipant]');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
