import { AIDrafterService } from './src/services/ai-drafter.js';
import { ManifestBuilderService } from './src/services/manifest-builder.js';
import { BlogGeneratorService } from './src/services/blog-generator.js';
import type { Manifest, ManifestSection } from './src/types/content.js';

// Mock environment for testing
const mockEnv = {
  ai: {
    run: async (model: string, options: any) => {
      console.log(`🤖 Mock AI called with model: ${model}`);
      console.log(`📝 Prompt: ${options.prompt.substring(0, 200)}...`);
      
      // Return a mock AI response
      return {
        response: JSON.stringify({
          intro: "Today's development session was focused on improving the content pipeline and implementing new features. We made significant progress across multiple areas.",
          sections: [
            {
              paragraph: "In this section, we worked on optimizing the manifest builder to handle larger datasets more efficiently. The improvements include better memory management and faster processing times."
            },
            {
              paragraph: "Here we implemented the new AI drafting feature using Workers AI Gemma. This allows for automatic generation of blog post content from manifest data."
            }
          ],
          outro: "Overall, today's work significantly enhanced our content generation capabilities and set up a solid foundation for future improvements."
        })
      };
    }
  },
  R2_BUCKET: {} as any,
  JOB_STORE: {} as any,
  JOB_QUEUE: {} as any,
  VECTORIZE: {} as any,
  DISCORD_BOT_TOKEN: 'mock-token',
  DISCORD_REVIEW_CHANNEL_ID: 'mock-channel-id',
  GITHUB_APP_ID: 'mock-app-id',
  GITHUB_INSTALLATION_ID: 'mock-installation-id',
  GITHUB_PRIVATE_KEY: 'mock-private-key',
  GITHUB_WEBHOOK_SECRET: 'mock-webhook-secret',
  GITHUB_TOKEN: 'mock-token',
  CONTENT_REPO_OWNER: 'test',
  CONTENT_REPO_NAME: 'repo',
  CONTENT_REPO_MAIN_BRANCH: 'main',
  HMAC_SHARED_SECRET: 'mock-hmac-secret',
  TWITCH_CLIENT_ID: 'mock-client-id',
  TWITCH_CLIENT_SECRET: 'mock-secret',
  TWITCH_BROADCASTER_ID: 'mock-broadcaster-id',
};

// Mock manifest for testing
const mockManifest: Manifest = {
  schema_version: '1.0.0',
  post_id: '2024-01-15',
  date_utc: '2024-01-15T00:00:00.000Z',
  tz: 'UTC',
  title: 'Daily Dev Recap: Content Pipeline Improvements',
  summary: 'Today we focused on improving the content pipeline and implementing new AI features.',
  category: 'development',
  tags: ['development', 'ai', 'pipeline'],
  clip_ids: ['clip1', 'clip2'],
  sections: [
    {
      section_id: 'section1',
      clip_id: 'clip1',
      title: 'Manifest Builder Optimization',
      bullets: [
        'Improved memory management for large datasets',
        'Faster processing times with better algorithms',
        'Enhanced error handling and logging'
      ],
      paragraph: 'Worked on optimizing the manifest builder.',
      repo: 'test/repo',
      pr_links: ['https://github.com/test/repo/pull/123'],
      clip_url: 'https://clips.twitch.tv/test-clip-1',
      vod_jump: 'https://twitch.tv/videos/123?t=1h2m3s',
      alignment_status: 'exact',
      start: 0,
      end: 120,
      entities: ['manifest', 'optimization', 'performance']
    },
    {
      section_id: 'section2',
      clip_id: 'clip2',
      title: 'AI Drafting Implementation',
      bullets: [
        'Integrated Workers AI Gemma for content generation',
        'Implemented idempotent drafting with content hashing',
        'Added fallback mechanisms for AI failures'
      ],
      paragraph: 'Implemented new AI drafting features.',
      repo: 'test/repo',
      pr_links: ['https://github.com/test/repo/pull/124'],
      clip_url: 'https://clips.twitch.tv/test-clip-2',
      vod_jump: 'https://twitch.tv/videos/123?t=2h3m4s',
      alignment_status: 'exact',
      start: 0,
      end: 180,
      entities: ['ai', 'drafting', 'gemma']
    }
  ],
  canonical_vod: 'https://twitch.tv/videos/123',
  md_path: 'content/blog/development/2024-01-15.md',
  target_branch: 'staging',
  status: 'draft'
};

/**
 * Test AI drafting functionality
 */
async function testAIDrafting() {
  console.log('🧪 Testing AI Drafting Functionality\n');

  try {
    // Test 1: AI Drafter Service
    console.log('1. Testing AI Drafter Service...');
    const aiDrafter = new AIDrafterService(mockEnv);
    const draftingResult = await aiDrafter.generateDraft(mockManifest);
    
    console.log('✅ AI Draft generated:');
    console.log(`   - Intro: ${draftingResult.draft.intro.substring(0, 100)}...`);
    console.log(`   - Sections: ${draftingResult.draft.sections.length}`);
    console.log(`   - Outro: ${draftingResult.draft.outro.substring(0, 100)}...`);
    console.log(`   - Model: ${draftingResult.gen.model}`);
    console.log(`   - Prompt Hash: ${draftingResult.promptHash.substring(0, 8)}...`);
    console.log();

    // Test 2: Manifest Builder with AI Drafting
    console.log('2. Testing Manifest Builder with AI Drafting...');
    const manifestBuilder = new ManifestBuilderService(mockEnv);
    const manifestWithDraft = await manifestBuilder.generateAIDraft(mockManifest);
    
    console.log('✅ Manifest updated with AI draft:');
    console.log(`   - Has draft: ${!!manifestWithDraft.draft}`);
    console.log(`   - Has gen metadata: ${!!manifestWithDraft.gen}`);
    console.log(`   - Model: ${manifestWithDraft.gen?.model}`);
    console.log();

    // Test 3: Blog Generator with AI Content
    console.log('3. Testing Blog Generator with AI Content...');
    const blogGenerator = new BlogGeneratorService(mockEnv);
    const blogResult = await blogGenerator.generateBlogPost(manifestWithDraft);
    
    console.log('✅ Blog post generated:');
    console.log(`   - Word count: ${blogResult.wordCount}`);
    console.log(`   - Read time: ${blogResult.estimatedReadTime} min`);
    console.log(`   - Has AI metadata: ${!!blogResult.frontMatter.ai_generated}`);
    console.log(`   - AI model: ${blogResult.frontMatter.ai_model}`);
    console.log();

    // Test 4: Idempotency Test
    console.log('4. Testing Idempotency...');
    const draftingResult2 = await aiDrafter.generateDraft(mockManifest);
    
    console.log('✅ Idempotency check:');
    console.log(`   - Same prompt hash: ${draftingResult.promptHash === draftingResult2.promptHash}`);
    console.log(`   - Same content hash: ${draftingResult.contentHash === draftingResult2.contentHash}`);
    console.log();

    // Test 5: Content Preview
    console.log('5. Content Preview:');
    console.log('--- Blog Post Preview ---');
    console.log(blogResult.markdown.substring(0, 500) + '...');
    console.log('------------------------');

    console.log('\n🎉 All AI drafting tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAIDrafting();
