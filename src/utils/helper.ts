import type { Space } from '@/types';
import { dayjs } from 'element-plus';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc)

export const sleep = async (time: number) => {
  time = time * 1000
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(true);
    }, time)
  })
}

export const sleep2 = async (time: number, callback: any, step = 1) => {
  let t = Date.now() + time * 1000;
  while (Date.now() < t) {
    await sleep(step);
    if (callback && callback()) break;
  }
}

export const getRequestPages = (length: number) => {
  return Math.floor((length - 1) / 30) + 1;
}

export var bytesToHex = function (bytes: any) {
  for (var hex = [], i = 0; i < bytes.length; i++) {
      hex.push((bytes[i] >>> 4).toString(16));
      hex.push((bytes[i] & 0xF).toString(16));
  }
  return hex.join("");
}

export const u8arryToHex = (buffer: any) => {
  return [...new Uint8Array(buffer)]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
}

export const hexTou8array = (hex: string) => {
  // @ts-ignore
  return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
}

export const hexToString = (str: string) => {
  if (str.length % 2 !== 0){
    console.log('Not a hex');
    return ""
  }
  str = str.replace('0x', '')
   let val = "";
   for (let i = 0; i < str.length; i+=2) {
     const n = parseInt(str[i] + str[i+1], 16)
     val += String.fromCharCode(n);
   }
   return val;
}

export const stringToHex = (str: string) => {
  let val = "";
  for (let i = 0; i < str.length; i++) {
    if (val == "") {
      val = str.charCodeAt(i).toString(16).padStart(2, '0');
    } else {
      val += str.charCodeAt(i).toString(16).padStart(2, '0');
    }
  }
  return val;
}

export function stringLength(str: string) {
  if (!str || str.length === 0) return 0;
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if ((c >= 0x0001 && c <= 0x007e) || (0xff60 <= c && c <= 0xff9f)) {
      len++;
    }else {
      len += 2;
    }
  }
  return len;
}

export const formatPrice = (value: number | string, abb = false) => {
  if (!value) return "$0.00";
  let unit = ''
  if (Number(value) > 1e7) {
    abb = true
  }

  let digit = 3
  if (Number(value) > 1e3) {
    digit = 0
  }
  if(Number(value) > 1e5) {
    digit = 2
  }
  if (Number(value) < 1) {
    digit = 4
  }
  if (Number(value) < 0.001) {
    digit = 8
  }
  if (Number(value) < 0.00000001) {
    digit = 10
  }
  if (Number(value) % 1 === 0) {
    digit = 0
  }
  if (Number(value) < 0.0000000001) {
    return '$0.0'
  }
  if (abb) {
    value = Number(value)
    if (value < 1000) { }
    else if (value < 1e6) {
      value = value / 1000
      unit = 'K'
    } else if (value < 1e9) {
      value = value / 1e6
      unit = 'M'
    } else if (value < 1e12) {
      value = value / 1e9
      unit = 'B'
    }
  }
  const str = Number(value).toFixed(digit).toString();
  let integer = str;
  let fraction = "";
  if (str.includes(".")) {
    integer = str.split(".")[0];
    fraction = "." + str.split(".")[1];
  }
  return "$" + integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + fraction + unit;
};

export const formatAmount = function (value: number | string | undefined) {
  if (!value) return "0.00";
  let unit = ''
  let digit = 3
  const nm = Number(value)
  if (nm < 1) {
    digit = 4
  }
  if (nm < 0.0001) {
    digit = 6
  }
  if (nm < 0.000001) {
    digit = 8
  }
  if (nm < 0.00000001) {
    return '0.00'
  }
  if (nm > 1000) {
    digit = 2
  }

  if (Number.isInteger(nm)) {
    digit = 0
    if (nm > 1000) {
      digit = 2
    }
  }
  value = Number(value)
  if (value < 1e6) {
  } else if (value < 1e9) {
    value = value / 1e6
    unit = 'M'
  } else if (value < 1e12) {
    value = value / 1e9
    unit = 'B'
  } else if (value < 1e18) {
    value = value / 1e12
    unit = 'T'
  } else {
    value = value.toString()
    if (value.indexOf('e') !== -1) {
      const [number, type] = value.split('e')
      return `${parseFloat(number).toFixed(2)}e${type.replace('+', '')}`
    } else {
      value = Number(value)
    }
  }
  const str = value.toFixed(digit).toString();
  let integer = str;
  let fraction = "";
  if (str.includes(".")) {
    integer = str.split(".")[0];
    fraction = "." + str.split(".")[1];
  }
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + fraction + unit;
}

export function formatAddress(val: string, start = 6, end = 6) {
  if (!val || val === '' || val.length < 12) return val
  return `${val.substring(0, start)}...${val.substring(val.length - end)}`
}

export function getDateString(now: any, timezone: any, extra = 0) {
  now = now || new Date();
  const offset = timezone != null ? timezone * 3600 : 0;
  now = new Date(now.getTime() + (offset + extra) * 1000);
  return now.toISOString().replace("T", " ").substring(0, 19);
}

export function formatPastTime(timeSecond: number) {
  const now = Math.ceil(Date.now() / 1000);
  if (timeSecond > now) return '0s'
  let diff = now - timeSecond;
  if (diff < 60) {
    return diff + 's'
  }else if(diff < 3600) {
    return Math.floor(diff / 60) + 'm'
  }else if (diff < 86400 * 2) {
    return Math.floor(diff / 3600) + 'h'
  }else if (diff < 86400 * 30) {
    return Math.floor(diff / 86400) + 'd'
  }else {
    return Math.floor(diff / 86400 / 30) + 'M'
  }
}

export function parseTimestamp(time: any) {
  if (!time) {
    return ''
  }
  
  let timestamp = new Date(time).getTime() / 1000
  // if (typeof(time) === 'string' && !time.match(/^[0-9]$/)) {
  //   let local = new Date().getTimezoneOffset()
  //   timestamp = timestamp + local * 60
  // }

  let nowStamp = new Date().getTime() / 1000
  nowStamp = Math.ceil(nowStamp)
  timestamp = Math.ceil(timestamp)
  let diff = nowStamp - timestamp;
  if (diff < 0) {
    diff = timestamp - nowStamp
    if (diff < 10) {
      return 'Now'
    } else if (diff < 60) {
      return `${diff} seconds left`
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} mins left`
    } else if (diff < 3600 * 24) {
      return `${Math.floor(diff / 3600)} hours left`
    } else if (diff < 3600 * 24 * 30) {
      return `${Math.floor(diff / 3600 / 24)} days left`
    } else if (diff < 3600 * 24 * 60) {
      return '1 month left'
    } else {
      return getDateString(null, null, timestamp - nowStamp)
    }
  } else {
    if (diff < 10) {
      return 'Now'
    } else if (diff < 60) {
      return `${diff} seconds ago`
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} mins ago`
    } else if (diff < 3600 * 24) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 3600 * 24 * 30) {
      return `${Math.floor(diff / 3600 / 24)} days ago`
    } else {
      return getDateString(null, null, timestamp - nowStamp)
    }
  }
}

export function parseSpaceStartTime(time: any) {
  let monthMap = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  const local = localStorage.getItem('language')
  let d1 = new Date(time)
  if (local === 'zh') {
    return dayjs(time).locale('zh-cn').format('MMMDo HH:mm')
  }else {
    return dayjs(time).locale('en').format('MMM Do HH:mm')
    // return `${d1.getUTCHours() >= 12 ? prefixInteger(d1.getUTCHours() - 12, 2) + ":" + prefixInteger(d1.getMinutes(), 2) + 'PM' : prefixInteger(d1.getUTCHours(), 2) + ':' + prefixInteger(d1.getMinutes(), 2) + 'AM'}(UTC),${monthMap[d1.getUTCMonth()]} ${d1.getUTCDate()}`;
  }
}   

export function formatDate(date?: any) {
  date = date ?? dayjs();
  return dayjs(date).utc().format("YYYY-MM-DD HH:mm:ss");
}

export function formatKChartDate(date?: any, byDay = false) {
  if (byDay) {
    date = date ?? dayjs();
    return dayjs(date).format("MM-DD")
  }
  if (Date.now() - date < 86400000) {
    date = date ?? dayjs();
    return dayjs(date).format("HH:mm");
  }
  date = date ?? dayjs();
  return dayjs(date).format("MM-DD HH:mm");
}

export function parseSpaceLastTime(space: Space) {
  const start = space.startedAt;
  const end = space.endedAt;
  if (!start || !end) return '';
  let diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff < 0) return '';
  diff = Math.ceil(diff / 1000)
  if (diff < 60) {
    return diff + ' S';
  }else if (diff < 3600) {
    return `${Math.floor(diff / 60)} M ${diff % 60} S`;
  }else {
    return `${Math.floor(diff / 3600)} H ${Math.ceil(diff % 3600 / 60)} M`
  }
}

export const getDayNumber = () => {
  return Math.floor(Date.now() / 86400000)
}