import {PayloadData, base64urldecode, isNonEmptyJson} from "./payload";
import {SelfDescribingJson} from "./core";
import isEqual = require('lodash.isEqual');
import has = require('lodash.has');
import get = require('lodash.get');

/**
 * Datatypes (some algebraic) for representing context types
 */
export type ContextGenerator = (payload: SelfDescribingJson, eventType: string, schema: string) => SelfDescribingJson;
export type ContextPrimitive = SelfDescribingJson | ContextGenerator;
// ContextFilter takes the event payload and relevant schema
export type ContextFilter = (payload: SelfDescribingJson, eventType: string, schema: string) => boolean;
export type FilterContextProvider = [ContextFilter, ContextPrimitive];
interface RuleSet {
    accept?: string[] | string;
    reject?: string[] | string;
    regex?: string[] | string;
}
export type PathContextProvider = [RuleSet, ContextPrimitive];
export type ConditionalContextProvider = FilterContextProvider | PathContextProvider;

function isStringArray(input: any): boolean {
    if (Array.isArray(input)) {
        return input.every(function(i){ return typeof i === "string" });
    }
    return false;
}

/*
Is either an array of strings, or single string.
 */
function isValidRuleSetArg(input: any): boolean{
    return isStringArray(input) || typeof input === 'string';
}

export function isSelfDescribingJson(input: any) : boolean {
    if (isNonEmptyJson(input)) {
        if ('schema' in input && 'data' in input) {
            return (typeof(input.schema) === 'string' && typeof(input.data) === 'object');
        }
    }
    return false;
}

export function isUnstructuredJson(input: any) : boolean {
    if (isSelfDescribingJson(input)) {
        if (get(input, 'schema') !== 'ue'){
            return ;
        }
    }
}

export function isRuleSet(input: any) : boolean {
    if (isNonEmptyJson(input)) {
        if (has(input, 'accept')) {
            if ()
        }
        if (has(input, 'reject')) {

        }
        if (has(input, 'regex')) {

        }
    }
    return false;
}

export function isContextGenerator(input: any) : boolean {
    if (typeof(input) === 'function') {
        return input.length === 1;
    }
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

function getSchema(sb: SelfDescribingJson): string | undefined {
    return get(sb, 'schema');
}

function getUnstructuredEventSchema(sb: SelfDescribingJson): string | undefined {
    return getSchema(sb);
}

function getUsefulSchema(sb: SelfDescribingJson): string {
    if ()
    return;
}

function getDecodedEvent(sb: SelfDescribingJson): SelfDescribingJson {
    if (has(sb, 'e.ue_px')) {
        sb['e']['eu_px'] = JSON.parse(base64urldecode(sb['ue_px']));
    }
    return sb;
}

function getEventType(sb: {}): string | undefined {
    return get(sb, 'e');
}

export function contextModule() {
    let globalPrimitives : Array<ContextPrimitive> = [];
    let conditionalProviders : Array<ConditionalContextProvider> = [];

    function generateContext(contextPrimitive: ContextPrimitive, event: SelfDescribingJson) : SelfDescribingJson {
        if (isSelfDescribingJson(contextPrimitive)) {
            return <SelfDescribingJson> contextPrimitive;
        } else if (isContextGenerator(contextPrimitive)) {
            return (contextPrimitive as ContextGenerator)(event);
        }
        return {'schema': '', 'data': {}};
    }

    function assembleAllContexts(event: PayloadData) : Array<SelfDescribingJson> {
        let builtEvent = event.build() as SelfDescribingJson;
        let builtSchema = buildEvent;
        let contexts : Array<SelfDescribingJson> = [];
        for (let context of globalPrimitives) {
            contexts = contexts.concat(generateContext(context, builtEvent));
        }

        for (let provider of conditionalProviders) {
            if (isFilterContextProvider(provider)) {
                let filter : ContextFilter = (provider as FilterContextProvider)[0];
                if (filter(event, schema)) {
                    contexts = contexts.concat(generateContext((provider as FilterContextProvider)[1], builtEvent));
                }
            } else if (isPathContextProvider(provider)) {
                let schema = getSchema(builtEvent);
                if (schema === undefined) {
                    continue;
                }

                if (matchSchema((provider as PathContextProvider), schema)) {
                    contexts = contexts.concat(generateContext((provider as PathContextProvider)[1], builtEvent));
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

        removeGlobalContext: function (context: ContextPrimitive) {
            globalPrimitives = globalPrimitives.filter(item => !isEqual(item, context));
        },

        removeConditionalContext: function (context: ConditionalContextProvider) {
            conditionalProviders = conditionalProviders.filter(item => !isEqual(item, context));
        },

        getApplicableContexts: function (event: PayloadData) : Array<SelfDescribingJson> {
            return assembleAllContexts(event);
        }
    };
}