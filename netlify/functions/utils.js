const fetch = require("node-fetch");
const crypto = require("crypto");
const secret = "qualquerCoisaAqui123";
function ip(headers){
  if(headers["x-nf-client-connection-ip"])return headers["x-nf-client-connection-ip"];
  if(headers["cf-connecting-ip"])return headers["cf-connecting-ip"];
  if(headers["x-real-ip"])return headers["x-real-ip"];
  const x = headers["x-forwarded-for"]||headers["X-Forwarded-For"];
  return x?x.split(",")[0].trim():null;
}
async function geo(ip){
  try{
    const r=await fetch("https://ipapi.co/"+ip+"/json/");
    if(!r.ok)return null;
    return r.json();
  }catch(e){return null;}
}
function sign(id){
  const s=crypto.createHmac("sha256",secret).update(id).digest("hex");
  return id+"."+s;
}
function verify(v){
  if(!v.includes("."))return null;
  const[a,b]=v.split(".");
  const s=crypto.createHmac("sha256",secret).update(a).digest("hex");
  return s===b?a:null;
}
module.exports={ip,geo,sign,verify};
