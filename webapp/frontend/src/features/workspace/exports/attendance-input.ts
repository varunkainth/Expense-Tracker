export function parseDayList(value:string,days:number):number[]{
  const result=new Set<number>();
  for(const item of value.split(',').map((part)=>part.trim()).filter(Boolean)){
    if(!/^\d{1,2}(?:\s*-\s*\d{1,2})?$/.test(item))throw new Error('Use day numbers or ranges, for example 5, 12-14.');
    const [start,last]=item.split('-').map(Number),end=last??start;
    if(start<1 || end<start || end>days)throw new Error(`Attendance days must be between 1 and ${days}.`);
    for(let day=start;day<=end;day++)result.add(day);
  }
  return [...result].sort((a,b)=>a-b);
}
