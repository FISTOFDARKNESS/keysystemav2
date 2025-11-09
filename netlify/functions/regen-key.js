const { getClient } = require("./_db");
const { v4 } = require("uuid");
const ttl=24;

exports.handler=async(e)=>{
  if(e.headers["x-admin-secret"]!=="1234")return{statusCode:401,body:JSON.stringify({success:false})};
  const b=JSON.parse(e.body||"{}");
  const id=b.visitor_id;
  if(!id)return{statusCode:400,body:JSON.stringify({success:false,message:"missing visitor_id"})};
  const db=getClient();
  await db.connect();
  const token=v4();
  const exp=new Date(Date.now()+ttl*3600000).toISOString();
  await db.query("INSERT INTO keys(token,owner_id,created_at,expires_at,issued_from_ip) VALUES($1,$2,now(),$3,$4)",[token,id,exp,"127.0.0.1"]);
  await db.end();
  return{statusCode:200,body:JSON.stringify({success:true,key:token,expires_at:exp})};
};
