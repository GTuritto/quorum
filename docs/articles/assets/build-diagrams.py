from pathlib import Path
from html import escape
import subprocess
ROOT=Path(__file__).resolve().parent
navy='#142C3B'; muted='#526574'; blue='#156CC1'; teal='#087F83'; bg='#F5F8FA'; line='#B7C9D5'
def text(x,y,s,size=28,color=navy,weight=400):
 return f'<text x="{x}" y="{y}" font-family="Arial, Helvetica, sans-serif" font-size="{size}" font-weight="{weight}" fill="{color}">{escape(s)}</text>'
def rect(x,y,w,h,fill='white',stroke=line,r=18):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
def arrow(x1,y1,x2,y2):
 return f'<path d="M {x1} {y1} L {x2} {y2}" fill="none" stroke="{teal}" stroke-width="4" marker-end="url(#arrow)"/>'
def base(title,desc,h):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="{h}" viewBox="0 0 1600 {h}" role="img"><title>{escape(title)}</title><desc>{escape(desc)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{teal}"/></marker></defs>'+rect(0,0,1600,h,bg,bg,0)
def save(name,s):
 p=ROOT/(name+'.svg');p.write_text(s+'</svg>');subprocess.run(['/opt/homebrew/bin/rsvg-convert','-o',str(ROOT/(name+'.png')),str(p)],check=True)
s=base('From a council service to a skill','Original idea: assistant connects through MCP to a separately operated council. Quorum places the review protocol inside the existing assistant; Full uses host delegation where available.',1000)
s+=text(70,80,'FROM A COUNCIL SERVICE TO A SKILL',19,teal,700)+text(70,142,'Bring the process into the assistant',48,navy,700)
s+=text(70,194,'The design choice behind Quorum',28,muted)
s+=rect(70,240,1460,250)+text(105,290,'ORIGINAL IDEA',21,muted,700)
for x,w,title,sub in [(110,350,'AI assistant','Your existing workspace'),(555,270,'MCP connection','Calls the service'),(920,565,'Council service','Operated locally or hosted elsewhere')]:
 s+=rect(x,325,w,110)+text(x+22,369,title,30,navy,700)+text(x+22,409,sub,23,muted)
s+=arrow(470,380,537,380)+arrow(835,380,902,380)
s+=rect(70,535,1460,350,'#E9F5F3','#70B7B4')+text(105,585,'QUORUM',21,teal,700)
s+=rect(110,615,1375,220,'white','#70B7B4')+text(140,658,'Your existing AI assistant',29,navy,700)
for x,w,title,sub in [(140,310,'Task + context','Goals and constraints'),(525,430,'Quorum skill','Proposals → review → synthesis'),(1030,420,'Recommendation','Reasons and open objections')]:
 s+=rect(x,692,w,110,'#F5F8FA')+text(x+20,732,title,28,navy,700)+text(x+20,772,sub,23,muted)
s+=arrow(460,747,508,747)+arrow(965,747,1012,747)
s+=text(70,935,'No separate council service. Full review depends on the host’s delegation capabilities.',27,muted)
save('quorum-skill-architecture',s)
s=base('How Quorum Full works','One task and its constraints go to isolated candidates. Anonymous proposals go to a fresh reviewer. The coordinator synthesizes a recommendation with evidence, uncertainty and important objections. Three candidates and one reviewer illustrate the default Full panel.',1130)
s+=text(70,80,'HOW QUORUM FULL WORKS',19,teal,700)+text(70,142,'Independent attempts. A reviewed recommendation.',45,navy,700)
s+=text(70,194,'Illustrated with three candidates and one fresh reviewer',28,muted)
s+=rect(390,245,820,106)+text(423,288,'The task, evidence and constraints',33,navy,700)+text(423,326,'Each candidate receives the necessary context',25,muted)
for x,title in [(70,'Candidate A'),(590,'Candidate B'),(1110,'Candidate C')]:
 s+=arrow(800,351,x+210,417)+rect(x,435,420,115)+text(x+28,480,title,31,blue,700)+text(x+28,520,'Develops a proposal in isolation',25,muted)
# Isolation is stated within each candidate box; keep connector space clear.
for x in [280,800,1320]:s+=arrow(x,550,800,658)
s+=rect(390,675,820,126,'#E9F5F3','#70B7B4')+text(425,720,'Anonymize proposals → independent review',31,teal,700)+text(425,762,'A fresh reviewer challenges claims and assumptions',25,muted)
s+=arrow(800,801,800,844)
s+=rect(390,860,820,125)+text(425,907,'Coordinator synthesis',32,navy,700)+text(425,952,'Recommendation + reasons + uncertainty + dissent',25,muted)
s+=text(70,1040,'Available when the host supports isolated workers. Panel size can vary.',25,muted)
s+=text(70,1082,'Agreement is not proof. Check consequential findings against evidence.',25,muted)
save('quorum-full-review',s)
