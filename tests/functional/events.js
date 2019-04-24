/*
 * JavaScript tracker for Snowplow: tests/functional/detectors.js
 *
 * Significant portions copyright 2010 Anthon Pang. Remainder copyright
 * 2012-2014 Snowplow Analytics Ltd. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * * Redistributions of source code must retain the above copyright
 *   notice, this list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 * * Neither the name of Anthon Pang nor Snowplow Analytics Ltd nor the
 *   names of their contributors may be used to endorse or promote products
 *   derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

const request = require('request');

var collector_endpoint = '<%= subdomain %>' + '.ngrok.io';

function resetMicro() {
    request.get(collector_endpoint + '/reset');
}

// schema is a string for Iglu URI
// contexts is an array of strings for Iglu URIs
function getValidEvents(schema, contexts, custom) {
    let options = {
        json: {
            schema: schema,
            contexts: contexts
        }
    };
    if (custom) {
        options = custom;
    }
    return new Promise((resolve, reject) => {
        request.post(collector_endpoint + '/good', options, function (error, response, body) {
            if (error) reject(error);
            if (response.statusCode !== 200) {
                reject('Invalid status code <' + response.statusCode + '>');
            }
            const json = JSON.parse(body);
            if (json.hasOwnProperty('count') && json.count === 0) {
                reject('No valid matching events');
            }
            resolve(body['events']);
        });
    });
}

function getCount() {
    return new Promise((resolve, reject) => {
        request.get(collector_endpoint + '/all', function (error, response, body) {
            if (error) reject(error);
            if (response.statusCode !== 200) {
                reject('Invalid status code <' + response.statusCode + '>');
            }
            const json = JSON.parse(body);
            if (!json.hasOwnProperty('good')) {
                reject('Missing good count');
            } else if (!json.hasOwnProperty('bad')) {
                reject('Missing bad count');
            } else if (!json.hasOwnProperty('total')) {
                reject('Missing total count');
            } else {
                resolve(json);
            }
        });
    });
}

define([
    'intern!object',
    'intern/chai!assert'
], function(registerSuite, assert) {

    registerSuite({

        name: 'Event tests',

        'Check structured event': async function() {
            resetMicro();
            this.remote.execute('window.snowplow(\'trackStructEvent\', \'Mixes\', \'Play\', \'MRC/fabric-0503-mix\', \'\', \'0.0\');');

            try {
                let events = await getValidEvents(null, null, { eventType: "se" });
                assert.isArray(events);
                assert.isEqual(events.length, 1);
                let count = await getCount();
                assert.isEqual(count.good, 1);
                assert.isEqual(count.bad, 0);
                assert.isEqual(count.total, 1);
            } catch (error) {
                assert.isEmpty(error);
            }
        }
    });
});
