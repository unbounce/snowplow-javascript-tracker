import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import json from '@rollup/plugin-json';

module.exports = [{
    input: 'src/js/index.js',
    output: [
        {
            file: 'dist/sp.umd.js',
            format: 'umd',
            name: 'snowplow'
        },
        {
            file: 'dist/sp.esm.js',
            format: 'esm'
        }
    ],
    plugins: [
        json(),
        resolve({
            browser: true
        }),
        commonjs(),
        babel({
            exclude: 'node_modules/**' // only transpile our source code
        })
    ]
},
{
    input: 'src/js/init.js',
    output: [
        {
            file: 'dist/snowplow.js',
            format: 'iife'
        },
        {
            file: 'dist/sp.js',
            format: 'iife',
            plugins: [terser()]
        }
    ],
    plugins: [
        json(),
        resolve({
            browser: true
        }),
        commonjs(),
        babel({
            exclude: 'node_modules/**' // only transpile our source code
        })
    ]
}
];