import {PayloadData, base64urldecode, isNonEmptyJson} from "./payload";
import {SelfDescribingJson} from "./core";
import isEqual = require('lodash.isequal');

/**
 * Datatypes (some algebraic) for representing context types
 */
export type ContextGenerator = (PayloadData) => SelfDescribingJson;
export type ContextPrimitive = SelfDescribingJson | ContextGenerator;
export type ContextFilter = (Payload) => boolean;
export type FilterContextProvider = [ContextFilter, ContextPrimitive];
export type PathContextProvider = [string | Array<string>, ContextPrimitive];
export type ConditionalContextProvider = FilterContextProvider | PathContextProvider;

export function isSelfDescribingJson(input: any) : boolean {
    if (isNonEmptyJson(input)) {
        if ('schema' in input && 'data' in input) {
            return (typeof(input.schema) === 'string' && typeof(input.data) === 'object');
        }
    }
    return false;
}

export function isContextGenerator(input: any) : boolean {
    if (typeof(input) === 'function') {
        return input.length === 1;
    };
    return false;
}

export function isContextFilter(input: any) : boolean {
    if (typeof(input) === 'function') {
        return input.length === 1;
    }
    return false;
}

export function isContextPrimitive(input: any) : boolean {
    return (isContextGenerator(input) || isSelfDescribingJson(input));
}

export function isFilterContextProvider(input: any) : boolean {
    if (Array.isArray(input)) {
        if (input.length === 2) {
            return isContextFilter(input[0]) && isContextPrimitive(input[1]);
        }
    }
    return false;
}

export function isSchemaMatchArg(input: any) : boolean {
    if (typeof (input) === 'string') {
        return true;
    }

    if (Array.isArray(input)) {
        if (input.length === 0) {
            return false;
        }
        return input.every((x) => (typeof(x) === 'string'));
    }

    return false;
}

export function isPathContextProvider(input: any) : boolean {
    if (Array.isArray(input)) {
        if (input.length === 2) {
            return isSchemaMatchArg(input[0]) && isContextPrimitive(input[1]);
        }
    }
    return false;
}

export function isConditionalContextProvider(input: any) : boolean {
    return isFilterContextProvider(input) || isPathContextProvider(input);
}

function matchSchema(provider: PathContextProvider, schema: string) : boolean {
    if (isPathContextProvider(provider)) {
        let mm = require('micromatch');
        if (typeof(provider[0]) === 'string') {
            return mm.isMatch(provider[0], schema);
        } else if (Array.isArray(provider[0])) {
            return (provider[0] as Array<string>).every((x) => (mm.isMatch(x, schema)));
        }
    }
    return false;
}

function getSchema(sb: {}): string | undefined {
    let event : SelfDescribingJson | undefined = getDecodedEvent(sb);
    let schema : string = '';
    if (event !== undefined) {
        schema = event['schema'];
    }

    return schema;
}

function getDecodedEvent(sb: {}): SelfDescribingJson | undefined {
    let event : SelfDescribingJson = {schema: '', data: {}};
    switch (sb['e']) { // TODO: get first-class schema too
        case 'ue':
            if ('ue_pr' in sb) {
                event = sb['ue_pr'];
            } else if ('ue_px' in sb) {
                let decodedEvent = JSON.parse(base64urldecode(sb['ue_px']));
                if ('schema' in decodedEvent && 'data' in decodedEvent) {
                    return decodedEvent
                } else {
                    return event;
                }
            }
    }

    return event;
}

function getEventType(sb: {}): string | undefined {
    if ('e' in sb) {
        return sb['e'];
    }
}

export function contextModule() {
    let globalPrimitives : Array<ContextPrimitive> = [];
    let conditionalProviders : Array<ConditionalContextProvider> = [];

    function generateContext(contextPrimitive: ContextPrimitive, event: PayloadData) : SelfDescribingJson {
        if (isSelfDescribingJson(contextPrimitive)) {
            return <SelfDescribingJson> contextPrimitive;
        } else if (isContextGenerator(contextPrimitive)) {
            return (contextPrimitive as ContextGenerator)(event);
        }
        return {'schema': '', 'data': {}};
    }

    function assembleAllContexts(event: PayloadData) : Array<SelfDescribingJson> {
        let contexts : Array<SelfDescribingJson> = [];
        for (let context of globalPrimitives) {
            contexts = contexts.concat(generateContext(context, event));
        }

        for (let provider of conditionalProviders) {
            if (isFilterContextProvider(provider)) {
                let filter : ContextFilter = (provider as FilterContextProvider)[0];
                if (filter(event)) {
                    contexts = contexts.concat(generateContext((provider as FilterContextProvider)[1], event));
                }
            } else if (isPathContextProvider(provider)) {
                let schema = getSchema(event);
                if (schema === undefined) {
                    continue;
                }

                if (matchSchema((provider as PathContextProvider), schema)) {
                    contexts = contexts.concat(generateContext((provider as PathContextProvider)[1], event));
                }
            }
        }

        return contexts;
    }

    return {
        addConditionalContexts: function (contexts: Array<ConditionalContextProvider>) {
            conditionalProviders = conditionalProviders.concat(contexts);
        },

        addGlobalContexts: function (contexts: Array<ContextPrimitive>) {
            globalPrimitives = globalPrimitives.concat(contexts);
        },

        clearAllContexts: function () {
            conditionalProviders = [];
            globalPrimitives = [];
        },

        removeGlobalContext: function (context: SelfDescribingJson) {
            globalPrimitives.filter(item => isEqual(item, context));
        },

        getApplicableContexts: function (event: PayloadData) : Array<SelfDescribingJson> {
            return assembleAllContexts(event);
        }
    };
}