import type { ActivityTag, GuessResult, QuestionNode } from '../types'

export const baseQuestions: QuestionNode[] = [
  { id:'mood', eyebrow:'まずは、今の気持ち', prompt:'今日はどんな一日でしたか？', options:[['とても穏やか','5','😌'],['まあまあ','4','🙂'],['ふつう','3','🌿'],['少し疲れた','2','🌧️'],['つらかった','1','🌙']].map(([label,value,icon])=>({label,value,icon})) },
  { id:'condition', eyebrow:'からだの声も少し', prompt:'体調はどうでしたか？', options:[['とても良い','5'],['良い','4'],['ふつう','3'],['少し疲れた','2'],['休みたい','1']].map(([label,value])=>({label,value})) },
]

export const activityQuestions: QuestionNode[] = [
 {id:'exercise',prompt:'今日は体を動かしましたか？',options:yesNo('運動')},
 {id:'exerciseType',prompt:'どんなふうに体を動かしましたか？',when:a=>a.exercise==='yes',options:[{label:'散歩・ウォーキング',value:'walk',icon:'🚶',tags:['散歩']},{label:'ランニング',value:'run',icon:'🏃'},{label:'筋トレ・ヨガ',value:'training',icon:'🧘'},{label:'スポーツ',value:'sports',icon:'🏸'}]},
 {id:'outing',prompt:'今日は外へ出かけましたか？',options:yesNo('外出')},
 {id:'outingType',prompt:'どんな目的のお出かけでしたか？',when:a=>a.outing==='yes',options:[{label:'仕事・学校',value:'work'},{label:'食事・カフェ',value:'food'},{label:'遊び・レジャー',value:'leisure'},{label:'用事',value:'errand'}]},
 {id:'shopping',prompt:'何か買い物をしましたか？',options:yesNo('買い物')},
 {id:'meeting',prompt:'誰かと会って過ごしましたか？',options:yesNo('人と会った')},
 {id:'meetingType',prompt:'どなたと会いましたか？',when:a=>a.meeting==='yes',options:[{label:'家族',value:'family'},{label:'友人',value:'friend'},{label:'同僚・クラスメイト',value:'colleague'},{label:'初めて会う人',value:'new'}]},
 {id:'work',prompt:'仕事や勉強をしましたか？',options:yesNo('仕事・勉強')},
 {id:'home',prompt:'家でゆっくりする時間はありましたか？',options:yesNo('おうち時間')},
]

function yesNo(tag:ActivityTag){return [{label:'はい',value:'yes',icon:'○',tags:[tag]},{label:'少し',value:'little',icon:'◌',tags:[tag]},{label:'いいえ',value:'no',icon:'—'},{label:'わからない',value:'unknown',icon:'…'}]}

export function visibleActivityQuestions(answers:Record<string,string>):QuestionNode[]{
  const result:QuestionNode[]=[]
  for(const q of activityQuestions){ if(!q.when || q.when(answers)) result.push(q); if(result.length>=7) break }
  return result
}
export function buildGuess(answers:Record<string,string>):GuessResult{
  const tags:ActivityTag[]=[]
  activityQuestions.forEach(q=>q.options.find(o=>o.value===answers[q.id])?.tags?.forEach(t=>{if(!tags.includes(t))tags.push(t)}))
  let text='今日は、自分のペースで一日を過ごした'
  if(answers.meetingType==='friend'&&answers.outingType==='food') text='今日は友人と食事に出かけた'
  else if(answers.exerciseType==='walk') text='今日は外を散歩して、気分転換をした'
  else if(answers.exercise==='yes') text='今日は体を動かして過ごした'
  else if(answers.shopping==='yes') text='今日は買い物に出かけた'
  else if(answers.work==='yes') text='今日は仕事や勉強に取り組んだ'
  else if(answers.home==='yes') text='今日は家でゆっくり過ごした'
  return {text,tags}
}
