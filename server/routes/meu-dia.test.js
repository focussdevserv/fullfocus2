import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { register } from "./meu-dia.js";
const ORG = "00000000-0000-0000-0000-000000000001";
function setup() { const calls=[]; const pool={query:async(sql,params)=>{calls.push({sql,params}); if(sql.includes("from tasks")) return {rows:[{open:2,done:1,overdue:1,dueToday:0}],rowCount:1}; if(sql.includes("from events")) return {rows:[{id:1,title:"Reunião"}],rowCount:1}; return {rows:[],rowCount:0};}}; const app=express(); app.use(express.json()); register(app,{pool,tenant:(_r,res)=>{res.locals.org=ORG;return ORG;},classifyDbError:(_e,f)=>({status:503,error:f})}); const server=createServer(app); return {server,calls}; }
async function request(t,path){await new Promise((resolve)=>t.server.listen(0,resolve)); const port=t.server.address().port; const r=await fetch(`http://127.0.0.1:${port}${path}`); t.server.close(); return r;}
test("summary filtra por organização",async()=>{const t=setup();const r=await request(t,"/api/tasks/summary");assert.equal(r.status,200);assert.equal(t.calls[0].params[0],ORG);});
test("upcoming aceita dias e filtra tenant",async()=>{const t=setup();const r=await request(t,"/api/events/upcoming?days=7");assert.equal(r.status,200);assert.deepEqual(t.calls[0].params,[ORG,7]);});
