import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMadisonReport,terminalEstimate} from '../site/terminal.js';
const report='963 GREEN BAY, WI Date: 11/2/2026 10:30 AM\nSupplier NO2ULS ULC10\nContract Average 5.1000 9.0000\n\n967 MADISON, WI Date: 11/2/2026 10:30 AM\nSupplier NO2ULS UNL-87 PRM-91 ULC10 MDC10\n-----------------\nContract Average 5.1895 3.0710 4.4256 2.9580 3.4271\n\n969 MILWAUKEE, WI Date: 11/2/2026 10:30 AM\nSupplier NO2ULS ULC10\nContract Average 5.1000 8.0000';
test('selects Madison and ULC10 by heading, not adjacent terminal or product',()=>{const r=parseMadisonReport(report);assert.equal(r.wholesale,2.958);assert.equal(r.reportDate,'2026-11-02');assert.equal(r.reportTime,'10:30 AM');assert.equal(terminalEstimate(r).price,3.817)});
test('rejects missing product, truncated columns, absent terminal and invalid dates',()=>{for(const s of [report.replace('ULC10 MDC10','WRONG MDC10'),report.replace('2.9580 3.4271','2.9580'),report.replace('967 MADISON','999 MADISON'),report.replaceAll('11/2/2026','2/30/2026')])assert.throws(()=>parseMadisonReport(s))});
test('missing or invalid saved report cannot produce a benchmark',()=>{assert.equal(terminalEstimate(null),null);assert.equal(terminalEstimate({...parseMadisonReport(report),wholesale:0}),null)});

test('terminal benchmark includes tax and assumed delivery before markup without rounding wholesale',()=>{const r=terminalEstimate(parseMadisonReport(report));assert.equal(r.wholesale,2.958);assert.equal(r.delivery,0.025);assert.ok(Math.abs(r.tax-0.513)<1e-12);assert.ok(Math.abs(r.base-3.496)<1e-12);assert.ok(Math.abs(r.raw-3.8169328)<1e-12);assert.equal(r.price,3.817)});
