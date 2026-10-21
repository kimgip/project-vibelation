import test from 'node:test';import assert from 'node:assert/strict';
import graph from '../src/mocks/step02-impact-graph.json' with {type:'json'};
import {validateImpactGraph} from '../src/domain/impactGraph.ts';
test('graph fixture and reference integrity',()=>{assert.equal(graph.nodes.length,19);assert.equal(graph.edges.length,15);assert.equal(validateImpactGraph(graph,'mock'),null);for(const mutate of [g=>g.nodes.push(g.nodes[0]),g=>g.edges[0].targetId='missing',g=>g.nodes[0].evidenceIds=['missing'],g=>g.edges[0].assessment='runtime_verified']){const g=structuredClone(graph);mutate(g);assert.equal(validateImpactGraph(g),'GRAPH_INVALID')}});
test('graph limits, unsupported schemas and analysis/source mismatch',()=>{assert.equal(validateImpactGraph({...graph,schemaVersion:'v99'}),'GRAPH_UNSUPPORTED');assert.equal(validateImpactGraph(graph,'other'),'GRAPH_INVALID');assert.equal(validateImpactGraph(graph,'mock',[]),null);assert.equal(validateImpactGraph({...graph,nodes:Array(101).fill(graph.nodes[0])}),'GRAPH_LIMIT_EXCEEDED')});

test('v3 only accepts three actions and known contextual references',()=>{for(const mutate of [g=>g.nodes[0].action='direct_change',g=>g.nodes[0].relatedTo=['missing'],g=>g.nodes[0].access=[{label:5}]]){const g=structuredClone(graph);mutate(g);assert.equal(validateImpactGraph(g),'GRAPH_INVALID')}});
