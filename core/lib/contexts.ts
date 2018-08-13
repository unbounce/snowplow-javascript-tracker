import {PayloadData, base64urldecode} from "./payload";
import {SelfDescribingJson} from "./core";

/**
 * Algebraic datatype representing context types
 */
export interface Context { readonly type: 'Context'; value: SelfDescribingJson }
export interface ContextGenerator { readonly type: 'ContextGenerator'; value: (PayloadData) => Context; }
export interface ContextPrimitive { readonly type: 'ContextPrimitive'; value: Context | ContextGenerator; }
export interface FilterContextProvider {
    readonly type: 'FilterContextProvider';
    value: [(PayloadData) => boolean, ContextPrimitive];
}
export interface PathContextProvider { readonly type: 'PathContextProvider'; value: [string , ContextPrimitive]; }
export interface ConditionalContextProvider {
    readonly type: 'ConditionalContextProvider';
    value: FilterContextProvider | PathContextProvider;
}

function matchSchema(provider: PathContextProvider, schema: string) : boolean {
    let mm = require('micromatch');
    return mm.isMatch(provider.value[0], schema);
}

function getSchema(sb: {}): string | undefined {
    let schema = '';

    switch (sb['e']) {
        case 'ue':
            let event = '';
            if ('ue_pr' in sb) {
                event = sb['ue_pr'];
            } else if ('ue_px' in sb) {
                event = base64urldecode(sb['ue_px']);
            } else {
                break;
            }
            schema = event['schema'];
            break;
    }

    return schema;
}

function getEventType(sb: {}): string | undefined {
    if ('e' in sb) {
        return sb['e'];
    }
}

export function contextModule() {
    let globalContexts : Array<ContextPrimitive> = [];
    let conditionalContexts : Array<ConditionalContextProvider> = [];

    function generateContext(contextPrimitive: ContextPrimitive, event: PayloadData) : Context {
        if (contextPrimitive.value.type === 'Context') {
            return contextPrimitive.value;
        } else if (contextPrimitive.value.type === 'ContextGenerator') {
            return contextPrimitive.value.value(event);
        }
        return {type: 'Context', value: {'schema': '', data: Object()}};
    }

    function assembleAllContexts(event: PayloadData) : Array<Context> {
        let contexts : Array<Context> = [];
        for (let context of globalContexts) {
            contexts = contexts.concat(generateContext(context, event));
        }

        for (let context of conditionalContexts) {
            if (context.value.type === 'FilterContextProvider') {
                let filter = context.value.value[0];
                if (filter(event)) {
                    contexts = contexts.concat(generateContext(context.value[1], event));
                }
            } else if (context.value.type === 'PathContextProvider') {
                let schema = getSchema(event);
                if (schema === undefined) {
                    continue;
                }

                if (matchSchema(context.value, schema)) {
                    contexts = contexts.concat(generateContext(context.value.value[1], event));
                }
            }
        }

        return contexts;
    }

    return {
        getApplicableContexts: function (event: PayloadData) : Array<SelfDescribingJson> {
            let contexts : Array<Context> = assembleAllContexts(event);
            let selfDescribingJsons : Array<SelfDescribingJson> = contexts.map((x) => x.value);
            return selfDescribingJsons;
        }
    };
}