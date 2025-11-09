const { getClient } = require("./_db");
const { v4 } = require("uuid");
const secret="1234";
const ttl=24;
exports.handler=async(e)=>{
  if(e.headers["x-admin-secret"]!==secret)return{statusCode:401,body:JSON.stringify({success:false})};
  const b=JSON.parse(e.body);
  const id=b.visitor_id;
  const db=getClient();
  await db.connect();
  const token=v4();
  const exp=new Date(Date.now()+ttl*3600000).toISOString();
  await db.query("insert into keys(token,owner_id,created_at,expires_at) values($1,$2,now(),$3)",[token,id,exp]);
  await db.end();
  return{statusCode:200,body:JSON.stringify({success:true,key:token,expires_at:exp})};
};
