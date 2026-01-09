import * as a1lib from 'alt1';
import './index.html';
import './appconfig.json';
import './icon.png';
import './styles.css';
import DialogReader from 'alt1/dialog';

import {
    copyToClipboard,
    getLocation,
    getSize,
    getTime,
    recognizeTextFromImage,
} from './utils';
import Tesseract, { createWorker } from 'tesseract.js';
import { OCRLogger } from './logger';

var output = document.getElementById('output');
var logs = document.getElementById('logs');
var worker: Tesseract.Worker;

const logger = OCRLogger.getInstance();

const version = '1.1.7';

output.insertAdjacentHTML(
    'beforeend',
    `<div class="version">v. ${version}</div>`
);

async function init() {
    if (window.alt1) {
        alt1.identifyAppUrl('./appconfig.json');

        logs.innerHTML =
            '<div class="center-absolute"><div class="spinner"></div></div>';

        try {
            // Create a Tesseract worker with paths relative to the base path
            worker = await createWorker('eng', 1, {
                workerPath: './tesseract/worker.min.js',
                corePath: './tesseract/tesseract-core.wasm.js',
                langPath: './tesseract/',
            });

            console.log('Worker created!');

            logs.innerHTML = '';

            output.insertAdjacentHTML(
                'beforeend',
                `<div class="nisbutton" onclick="StarScopeCall.capture();">Get "/call" command</div>`
            );

            output.insertAdjacentHTML(
                'beforeend',
                `<div class="log-controls">
                    <button class="nisbutton small" onclick="StarScopeCall.showLogStats();">Log Stats</button>
                    <button class="nisbutton small" onclick="StarScopeCall.exportLogsJSON();">Export JSON</button>
                    <button class="nisbutton small" onclick="StarScopeCall.exportLogsCSV();">Export CSV</button>
                    <button class="nisbutton small danger" onclick="StarScopeCall.clearLogs();">Clear Logs</button>
                </div>`
            );
        } catch (err) {
            console.error(err);
            logs.innerHTML = `<div class="error text-center center-absolute">Something went wrong, Tesseract did not load, please notify dev! :(</div>`;
        }
    } else {
        let addappurl = `alt1://addapp/${new URL('./appconfig.json', document.location.href).href}`;

        output.insertAdjacentHTML(
            'beforeend',
            `<a href='${addappurl}' class="app-link">
                <div class="nisbutton">Alt1 not detected, click here to add this app to Alt1</div>
            </a>`
        );
    }
}

init();

export function capture() {
    if (!window.alt1) {
        output.insertAdjacentHTML(
            'beforeend',
            `<div class="text-center">You need to run this page in alt1 to capture the screen</div>`
        );

        return;
    }

    if (
        !alt1.permissionPixel ||
        !alt1.permissionGameState ||
        !alt1.permissionOverlay
    ) {
        output.insertAdjacentHTML(
            'beforeend',
            `<div class="text-center">Page is not installed as app or not all permissions are enabled</div>`
        );

        return;
    }

    var img = a1lib.captureHoldFullRs();

    findDialogAndReadData(img);
}

async function findDialogAndReadData(img: a1lib.ImgRef) {
    const start = new Date().getTime();

    logs.innerHTML = '<div class="spinner"></div>';

    let pixels: ImageData;

    try {
        const diagReader = new DialogReader();
        const dialog: a1lib.RectLike = diagReader.find() as a1lib.RectLike;

        pixels = img.toData(
            dialog.x,
            dialog.y + 20,
            dialog.width,
            dialog.height - 40
        );
    } catch (err) {
        console.error(err);
        logs.innerHTML = `<div class="error text-center">Please use a telescope in order to have data to read from!</div>`;

        return;
    }

    const pngImage = await pixels.toFileBytes('image/png');

    const { rawText, cleanedText } = await recognizeTextFromImage(
        worker,
        new Blob([pngImage as any], { type: 'image/png' })
    );

    // let cleanedText = `You see a shooting star!
    //             The star looks like itwill land in The Lost Grove in the next 10 12 minutes.
    //             The star looks to be size 4,`;

    console.log(cleanedText);

    const world = alt1.currentWorld;
    const location = getLocation(cleanedText);
    const size = getSize(cleanedText);
    const time = getTime(cleanedText);

    const command = `/call world: ${world} region: ${location} size: ${size} relative-time: ${time}`;

    console.log(`Command: ${command}`);

    // Log the OCR data
    logger.addLog({
        timestamp: start,
        rawOCR: rawText,
        cleanedText: cleanedText,
        parsedData: {
            world,
            location,
            size,
            time,
        },
        finalCommand: command,
        processingTime: new Date().getTime() - start,
    });

    logs.innerHTML = '';

    const copySuccess = await copyToClipboard(command);

    if (copySuccess) {
        logs.insertAdjacentHTML(
            'beforeend',
            `<div class="text-center margin-bottom-5 success">Command copied to clipboard!</div>
            <div class="text-center bold">${command}</div>`
        );
    } else {
        logs.insertAdjacentHTML(
            'beforeend',
            `<div class="text-center margin-bottom-5 error">Failed to copy to clipboard. Please notify dev and copy manually:</div>
            <div class="text-center bold">${command}</div>`
        );
    }

    const end = new Date().getTime();
    console.log(`Time taken: ${end - start} milliseconds`);
    console.log(
        `---------------------------------------------------------------------------------------------------------------------`
    );
}

export function showLogStats() {
    const stats = logger.getStats();
    const oldestDate = stats.oldestLog
        ? new Date(stats.oldestLog).toLocaleString()
        : 'N/A';
    const newestDate = stats.newestLog
        ? new Date(stats.newestLog).toLocaleString()
        : 'N/A';

    // Create elements safely without innerHTML
    const statsDiv = document.createElement('div');
    statsDiv.className = 'log-stats';

    const title = document.createElement('h3');
    title.textContent = 'OCR Log Statistics';
    statsDiv.appendChild(title);

    const createStatLine = (label: string, value: string | number) => {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = label + ': ';
        p.appendChild(strong);
        p.appendChild(document.createTextNode(String(value)));
        return p;
    };

    statsDiv.appendChild(createStatLine('Total Logs', stats.total));
    statsDiv.appendChild(createStatLine('Errors', stats.errors));
    statsDiv.appendChild(
        createStatLine('Avg Processing Time', `${stats.avgProcessingTime}ms`)
    );
    statsDiv.appendChild(createStatLine('Oldest Log', oldestDate));
    statsDiv.appendChild(createStatLine('Newest Log', newestDate));

    logs.innerHTML = '';
    logs.appendChild(statsDiv);
}

export function exportLogsJSON() {
    logger.exportAsJSON();
}

export function exportLogsCSV() {
    logger.exportAsCSV();
}

export function clearLogs() {
    if (confirm('Are you sure you want to clear all logs?')) {
        logger.clearLogs();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-center success';
        messageDiv.textContent = 'Logs cleared!';
        logs.innerHTML = '';
        logs.appendChild(messageDiv);
    }
}
