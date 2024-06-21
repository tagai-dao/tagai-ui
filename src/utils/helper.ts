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

export function parseTimestamp(time: any) {
  if (!time) {
    return ''
  }
  let timestamp = new Date(time).getTime() / 1000
  if (typeof(time) === 'string' && !time.match(/^[0-9]$/)) {
    let local = new Date().getTimezoneOffset()
    timestamp = timestamp - local * 60
  }

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
