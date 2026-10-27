<script lang="ts">
  import { neventEncode } from 'applesauce-core/helpers';
  import { APP_RELAYS } from '$lib/nostr/relay-policy';
  
  export let eventId: string;
  export let pubkey: string;
  export let kind: number = 39089; // Default kind for follow list
  
  let copied = false;
  
  async function copyEvent() {
    // Encode a shareable event pointer
    const nevent = neventEncode({
      id: eventId,
      relays: APP_RELAYS,
      author: pubkey,
      kind: kind
    });
    
    const nostrLink = `nostr:${nevent}`;
    
    // Copy to clipboard using execCommand as fallback
    try {
      // Modern method
      await navigator.clipboard.writeText(nostrLink);
      
      // Show copied state
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.textContent = nostrLink;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
        copied = true;
        setTimeout(() => {
          copied = false;
        }, 2000);
      } catch (e) {
        console.error('Fallback copy failed:', e);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }
</script>

<button 
  on:click={copyEvent} 
  class="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-body bg-muted rounded-full hover:bg-placeholder transition-colors w-[90px]"
  title="Copy Nostr event link"
>
  {#if copied}
    <span>Copied!</span>
  {:else}
    <span>Copy Event</span>
  {/if}
</button> 