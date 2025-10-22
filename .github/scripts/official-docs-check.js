const https = require('https');
const { execSync } = require('child_process');

const prNumber = process.env.PR_NUMBER;
const repo = process.env.REPO;
const token = process.env.GITHUB_TOKEN;

function api(path){
  return new Promise((res, rej)=>{
    const opts = {
      hostname: 'api.github.com',
      path,
      method: 'GET',
      headers: {
        'User-Agent': 'official-docs-checker',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      }
    };
    const req = https.request(opts, r=>{
      let b=''; r.on('data',c=>b+=c); r.on('end',()=>{
        try{ res(JSON.parse(b)); }catch(e){ res({}); }
      });
    });
    req.on('error', rej);
    req.end();
  });
}

(async ()=>{
  try{
    if(!prNumber || !repo){
      console.error('Missing PR_NUMBER or REPO env vars');
      process.exit(1);
    }

    const repoPath = '/repos/'+repo;
    const pr = await api(repoPath + '/pulls/' + prNumber);
    const body = (pr.body||'') + '\n' + (pr.title||'');

    const checklistRegex = /official-docs/i;
    const mcpRegex = /mcp[- _]?(upstash|ddg|search|conte)/i;
    const urlRegex = /https?:\/\/(?:[^\s)]+)/i;

    if(checklistRegex.test(body) || mcpRegex.test(body)){
      console.log('Found official-docs or MCP references in PR body.');
      process.exit(0);
    }

    const files = await api(repoPath + '/pulls/' + prNumber + '/files');

    if(Array.isArray(files)){
      const changedNames = files.map(f=>f.filename).join('\n');
      if(checklistRegex.test(changedNames) || mcpRegex.test(changedNames)){
        console.log('Found official-docs or MCP references in changed files.');
        process.exit(0);
      }

      let found = false;
      for(const f of files){
        try{
          const content = await api(repoPath + '/contents/' + encodeURIComponent(f.filename) + '?ref=' + encodeURIComponent(pr.head.ref));
          let text = '';
          if(content && content.content){
            text = Buffer.from(content.content, content.encoding).toString('utf8');
          }
          if(checklistRegex.test(text) || mcpRegex.test(text) || urlRegex.test(text)){
            found = true; break;
          }
        }catch(e){ /* continue */ }
      }

      if(found){
        console.log('Found potential references in file contents.');
        process.exit(0);
      }
    }

    const commentBody = `:warning: Official docs check — this PR does not appear to include an "official-docs" reference or MCP search results. Please add an "official-docs" checklist item in the PR body and paste MCP search results (context IDs or links) or links to official docs that were considered.`;
    const payload = JSON.stringify({body: commentBody});
    const curlCmd = `curl -s -S -X POST -H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" https://api.github.com/repos/${repo}/issues/${prNumber}/comments -d '${payload}'`;
    execSync(curlCmd, {stdio:'inherit'});

    console.error('Official docs references not found — failing job.');
    process.exit(1);
  }catch(e){
    console.error('Error during official docs check', e);
    process.exit(1);
  }
})();
