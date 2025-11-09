const { getClient } = require("./_db");
const { ip, geo, sign, verify } = require("./utils");
const { v4 } = require("uuid");
const ttl=24;
function cookies(h){
  if(!h)return{};
  return Object.fromEntries(
    h.split(";").map(x=>{
      const[k,v]=x.trim().split("=");
      return[k,decodeURIComponent(v)];
    })
  );
}
exports.handler=async(e)=>{
  const headers=e.headers||{};
  const c=cookies(headers.cookie||headers.Cookie);
  let v=c["visitor_id"]||null;
  let id=verify(v);
  if(!id){
    id=v4();
    v=sign(id);
  }
  const clientIp=ip(headers);
  await geo(clientIp);
  const db=getClient();
  await db.connect();
  try{
    await db.query("insert into visitors(visitor_id) values($1) on conflict(visitor_id) do nothing",[id]);
    const now=new Date().toISOString();
    const r=await db.query("select token,expires_at from keys where owner_id=$1 and expires_at>$2",[id,now]);
    if(r.rows.length){
      return{statusCode:200,headers:{"Set-Cookie":"visitor_id="+v+"; Path=/; Max-Age=31536000; SameSite=Lax"},body:JSON.stringify({success:true,key:r.rows[0].token,expires_at:r.rows[0].expires_at})};
    }
    const token=v4();
    const exp=new Date(Date.now()+ttl*3600000).toISOString();
    await db.query("insert into keys(token,owner_id,created_at,expires_at,issued_from_ip) values($1,$2,now(),$3,$4)",[token,id,exp,clientIp]);
    return{statusCode:200,headers:{"Set-Cookie":"visitor_id="+v+"; Path=/; Max-Age=31536000; SameSite=Lax"},body:JSON.stringify({success:true,key:token,expires_at:exp})};
  }catch(e){
    return{statusCode:500,body:JSON.stringify({success:false})};
  }finally{
    await db.end();
  }
};
