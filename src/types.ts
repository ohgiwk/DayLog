export type MoodValue = 1 | 2 | 3 | 4 | 5
export type ActivityTag = '運動'|'散歩'|'外出'|'買い物'|'人と会った'|'仕事・勉強'|'おうち時間'
export interface DiaryEntry { id:string; date:string; mood:MoodValue; condition:number; answers:Record<string,string>; tags:ActivityTag[]; guess:string; guessResult:'correct'|'close'|'wrong'; body:string; tomorrow:string; imageIds:string[]; thumbnailImageId?:string; createdAt:string; updatedAt:string }
export interface DiaryImage { id:string; entryId:string; blob:Blob; type:string; createdAt:string }
export interface QuestionOption { label:string; value:string; icon?:string; tags?:ActivityTag[] }
export interface QuestionNode { id:string; prompt:string; eyebrow?:string; options:QuestionOption[]; when?:(answers:Record<string,string>)=>boolean }
export interface BranchCondition { questionId:string; equals:string }
export interface GuessResult { text:string; tags:ActivityTag[] }
export interface AppSettings { notifications:boolean; location:boolean; weather:boolean; reducedMotion:boolean; largeText:boolean }
