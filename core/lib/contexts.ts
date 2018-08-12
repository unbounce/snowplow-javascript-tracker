import {PayloadData} from "./payload";
import {SelfDescribingJson} from "./core";

/**
 * Algebraic datatype representing context types
 */
export type Context = SelfDescribingJson;
export type ContextGenerator = (PayloadData) => Context;
export type ContextProvider = Context | ContextGenerator;
export type ConditionalContextProvider = [(PayloadData) => boolean, ContextProvider];
export type PathContextProvider = [string , ContextProvider];

export function contextModule() {
    let mm = require('micromatch');

    // Lists of sticky contexts; global applied to all; generators are functions that create contexts;
    // conditionals are applied to only some
    let globalContexts : Array<Context> = [];

    let globalContextGenerators : Array<ContextGenerator> = [];

    let conditionalContexts : Array<Condition> = [];

    let pathConditionals = [];

    return {
        getApplicableContexts: function (event: PayloadData) : Array<SelfDescribingJson> {
            for
            return [];
        }
    };
}