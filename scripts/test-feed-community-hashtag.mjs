import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const read = name => readFileSync(new URL(`../src/${name}.vue`, import.meta.url), 'utf8')
const source = read('components/tweets/TweetItem')
const condition = source.match(/v-if="(tweet\.tags[^\"]*)"/)[1]
const showHashtag = new Function('tweet', 'hideCommunityHashtag', 'textOnly', `return Boolean(${condition})`)
const tweet = { tags: 'BUIDL', tick: 'BUIDL', token: '0x123' }

test('feed posts with a community token card hide only the redundant hashtag', () => {
  assert.equal(showHashtag(tweet, true, false), false)
  assert.match(source, /CommunityTradeCard v-if="tweet.tick && tweet.token"/)
  assert.match(source, /v-html="formatEmojiText\(content, true\)"/)
})
test('other pages and posts without a rendered token card keep the hashtag', () => {
  assert.equal(showHashtag(tweet, false, false), true)
  assert.equal(showHashtag(tweet, true, true), true)
  assert.equal(showHashtag({ ...tweet, token: undefined }, true, false), true)
  assert.equal(showHashtag({ ...tweet, tags: undefined }, false, false), false)
})
for (const name of ['views/home/HomePost', 'views/tag-detail/TagContent']) {
  test(`${name} opts in to hiding redundant community hashtags`, () => {
    assert.match(read(name), /<TweetItem\s+v-else\s+hide-community-hashtag/)
  })
}
for (const name of ['components/tweets/TweetItem', 'views/home/HomePost', 'views/tag-detail/TagContent']) {
  test(`${name} compiles`, () => {
    const filename = `${name}.vue`
    const { descriptor, errors } = parse(read(name), { filename })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: name })
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: name, compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
  })
}
