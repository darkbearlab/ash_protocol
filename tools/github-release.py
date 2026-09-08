"""Manage THIS project's Pages deployment using existing Git Credential Manager auth.

Never prints or stores credentials. Requires the already authorized darkbearlab account.
Commands: status, enable-pages, dispatch. Run only when publishing was authorized.
"""
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

REPO='darkbearlab/ash_protocol'
def credential():
    env={**os.environ,'GCM_INTERACTIVE':'never','GIT_TERMINAL_PROMPT':'0'}
    result=subprocess.run(['git','credential','fill'],input=f'protocol=https\nhost=github.com\npath={REPO}.git\n\n',capture_output=True,text=True,env=env,timeout=45)
    fields=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
    if result.returncode or not fields.get('password'):
        raise RuntimeError('Existing GitHub credentials unavailable. Sign in with Git Credential Manager first.')
    return fields['password']

def request(token,path,method='GET',body=None):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'ash-protocol-release','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=40) as response:
            raw=response.read();return response.status,json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        return error.code,{'message':json.loads(error.read()).get('message','GitHub API error')}

def main():
    command=sys.argv[1] if len(sys.argv)>1 else 'status';token=credential()
    if command=='enable-pages':
        status,data=request(token,'/pages')
        status,data=request(token,'/pages','POST' if status==404 else 'PUT',{'build_type':'workflow'})
        print(json.dumps({'operation':'enable-pages','status':status,'url':data.get('html_url'),'message':data.get('message')}))
        if status>=400:sys.exit(1)
    elif command=='dispatch':
        status,data=request(token,'/actions/workflows/pages.yml/dispatches','POST',{'ref':'main'})
        print(json.dumps({'operation':'dispatch','status':status,'message':data.get('message')}))
        if status>=400:sys.exit(1)
    elif command=='status':
        status,pages=request(token,'/pages');print(json.dumps({'pages_status':status,'url':pages.get('html_url'),'build_type':pages.get('build_type'),'message':pages.get('message')}))
        status,runs=request(token,'/actions/runs?per_page=5')
        print(json.dumps({'runs_status':status,'runs':[{'id':r['id'],'sha':r['head_sha'],'status':r['status'],'conclusion':r['conclusion'],'url':r['html_url']} for r in runs.get('workflow_runs',[])]}))
    else:raise ValueError('Supported commands: status, enable-pages, dispatch')

if __name__=='__main__':
    try:main()
    except Exception as error:print(type(error).__name__+': '+str(error));sys.exit(1)
