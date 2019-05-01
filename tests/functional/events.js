/*
 * JavaScript tracker for Snowplow: tests/functional/events.js
 *
 * Significant portions copyright 2010 Anthon Pang. Remainder copyright
 * 2012-2019 Snowplow Analytics Ltd. All rights reserved.
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

// URL of the Snowplow Micro to be interacted with
const COLLECTOR_ENDPOINT = '<%= subdomain %>' + '.ngrok.io';

// endpoints to interact with Snowplow Micro
const MICRO_GOOD  = "/micro/good";
const MICRO_BAD   = "/micro/bad";
const MICRO_ALL   = "/micro/all";
const MICRO_RESET = "/micro/reset";

// iglu URIs
const APPLICATION_INSTALL_EVENT = "iglu:com.snowplowanalytics.mobile/application_install/jsonschema/1-0-0";
const SCREEN_VIEW_EVENT = "iglu:com.snowplowanalytics.mobile/screen_view/jsonschema/1-0-0";
const SCREEN_CONTEXT = "iglu:com.snowplowanalytics.mobile/screen/jsonschema/1-0-0";
const APPLICATION_CONTEXT = "iglu:com.snowplowanalytics.mobile/application/jsonschema/1-0-0";

function resetMicro() {
    request.get(COLLECTOR_ENDPOINT + MICRO_RESET);
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
        request.post(COLLECTOR_ENDPOINT + MICRO_GOOD, options, function (error, response, body) {
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
        request.get(COLLECTOR_ENDPOINT + MICRO_ALL, function (error, response, body) {
            if (error) reject(error);
            if (response.statusCode !== 200) {
                reject('Invalid status code <' + response.statusCode + '>');
            }
            const json = JSON.parse(body);
            if (!json.hasOwnProperty('good')) {
                reject('Unexpected response from Micro: missing good count');
            } else if (!json.hasOwnProperty('bad')) {
                reject('Unexpected response from Micro: missing bad count');
            } else if (!json.hasOwnProperty('total')) {
                reject('Unexpected response from Micro: missing total count');
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

        'Check custom structured event': async function() {
            resetMicro();
            this.remote
                .get(require.toUrl('tests/pages/events.html'))
                .execute("window.snowplow('trackStructEvent', 'Mixes', 'Play', 'MRC/fabric-0503-mix', '', '0.0');");

            try {
                let events = await getValidEvents(null, null, { eventType: "se" });
                assert.isArray(events);
                assert.isEqual(events.length, 1);

                // check event specific fields
                let event = events[0];
                assert.isEqual(event.event, "struct");
                assert.isEqual(event.event_vendor, "com.google.analytics");
                assert.isEqual(event.event_name, "event");
                assert.isEqual(event.se_value, "0.0");
                assert.isEqual(event.se_property, null);
                assert.isEqual(event.se_label, "MRC/fabric-0503-mix");
                assert.isEqual(event.se_action, "Play");
                assert.isEqual(event.se_category, "Mixes");

                let count = await getCount();
                assert.isEqual(count.good, 1);
                assert.isEqual(count.bad, 0);
                assert.isEqual(count.total, 1);
            } catch (error) {
                assert.isEmpty(error);
            }

            return Promise.resolve("Successful custom structured test!");
        },

        'Check custom unstructured (self describing) event -- an application install event': async function() {
            resetMicro();
            this.remote
                .get(require.toUrl('tests/pages/events.html'))
                .execute(`window.snowplow('trackSelfDescribingEvent', { "schema": "${APPLICATION_INSTALL_EVENT}", "data": {} });`);

            try {
                let events = await getValidEvents(null, null, { eventType: "ue" });
                assert.isArray(events);
                assert.isEqual(events.length, 1);

                // check event specific fields
                let event = events[0];
                assert.isEqual(event.event, "unstruct");
                assert.isEqual(event.event_vendor, "com.snowplowanalytics.mobile");
                assert.isEqual(event.event_name, "application_install");
                assert.isEqual(event.unstruct_event_com_snowplowanalytics_mobile_application_install_1, {});

                // check stats
                let count = await getCount();
                assert.isEqual(count.good, 1);
                assert.isEqual(count.bad, 0);
                assert.isEqual(count.total, 1);
            } catch (error) {
                assert.isEmpty(error);
            }

            return Promise.resolve("Successful application install test!");
        },

        'Check custom unstructured (self describing) event -- a screen view event': async function() {
            resetMicro();
            let sdj = JSON.stringify({
                "schema": `"${SCREEN_VIEW_EVENT}"`,
                "data"  : {
                    "name": "functionalTestScreenName",
                    "id": "functionalTestScreenID"
                }
            }, null, 2);
            this.remote
                .get(require.toUrl('tests/pages/events.html'))
                .execute(`window.snowplow('trackSelfDescribingEvent', ${sdj});`);

            try {
                let events = await getValidEvents(null, null, { eventType: "ue" });
                assert.isArray(events);
                assert.isEqual(events.length, 1);

                // check event specific fields
                let event = events[0];
                assert.isEqual(event.event, "unstruct");
                assert.isEqual(event.event_vendor, "com.snowplowanalytics.mobile");
                assert.isEqual(event.event_name, "screen_view");
                assert.isEqual(
                    event.unstruct_event_com_snowplowanalytics_mobile_screen_view_1,
                    {
                        "name": "functionalTestScreenName",
                        "id": "functionalTestScreenID"
                    }
                );

                // check stats
                let count = await getCount();
                assert.isEqual(count.good, 1);
                assert.isEqual(count.bad, 0);
                assert.isEqual(count.total, 1);
            } catch (error) {
                assert.isEmpty(error);
            }

            return Promise.resolve("Successful screen view test!");
        }
    });

    registerSuite({

       name: 'Context tests',

        'Check screen context': async function() {
            resetMicro();
            let screenContext = JSON.stringify(
                [
                    {
                        "schema": `"${SCREEN_CONTEXT}"`,
                        "data"  : {
                            "activity": "FunctionalTestActivity",
                            "name": "ScreenContextTest",
                            "id": "86936750-04ee-4b61-aeee-99d96aef8c54",
                            "type": "Functional"
                        }
                    }
                ], null, 2);
            this.remote
                .get(require.toUrl('tests/pages/events.html'))
                .execute(`window.snowplow('trackPageView', null, ${screenContext});`);

            try {
                let events = await getValidEvents(null, null, { eventType: "page_view" });
                assert.isArray(events);
                assert.isEqual(events.length, 1);

                let event = events[0];
                assert.isEqual(event.event, "page_view");
                assert.isEqual(event.event_vendor, "com.snowplowanalytics.snowplow");
                assert.isEqual(event.event_name, "page_view");
                assert.isEqual(
                    event.contexts_com_snowplowanalytics_mobile_screen_1,
                    {
                        "activity": "FunctionalTestActivity",
                        "name": "ScreenContextTest",
                        "id": "86936750-04ee-4b61-aeee-99d96aef8c54",
                        "type": "Functional"
                    }
                );
            } catch (error) {
                assert.isEmpty(error);
            }

            return Promise.resolve("Successful screen context test!");
        },

        'Check application context': async function() {
            resetMicro();
            let appContext = JSON.stringify(
                [
                    {
                        "schema": `"${APPLICATION_CONTEXT}"`,
                        "data"  : {
                            "build": "3",
                            "version": "0.3.0"
                        }
                    }
                ], null, 2);
            this.remote
                .get(require.toUrl('tests/pages/events.html'))
                .execute(`window.snowplow('trackPageView', null, ${appContext});`);

            try {
                let events = await getValidEvents(null, null, { eventType: "page_view" });
                assert.isArray(events);
                assert.isEqual(events.length, 1);

                let event = events[0];
                assert.isEqual(event.event, "page_view");
                assert.isEqual(
                    event.contexts_com_snowplowanalytics_mobile_application_1,
                    {
                        "build": "3",
                        "version": "0.3.0"
                    }
                );
            } catch (error) {
                assert.isEmpty(error);
            }

            return Promise.resolve("Successful application context test!");
        }

    });
});
