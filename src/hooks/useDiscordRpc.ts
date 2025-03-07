/* eslint-disable consistent-return */
import { useEffect, useState } from 'react';
import { AutoClient, Presence } from 'discord-auto-rpc';
import { notifyToast } from '../components/shared/toast';
import { useAppSelector } from '../redux/hooks';
import { Artist, Server } from '../types';

const useDiscordRpc = ({ playersRef }: any) => {
  const player = useAppSelector((state) => state.player);
  const playQueue = useAppSelector((state) => state.playQueue);
  const config = useAppSelector((state) => state.config);
  const [discordRpc, setDiscordRpc] = useState<any>();

  useEffect(() => {
    if (config.external.discord.enabled) {
      const client = new AutoClient({ transport: 'ipc' });

      if (discordRpc?.client !== config.external.discord.clientId) {
        client.endlessLogin({ clientId: config.external.discord.clientId });

        client.once('connected', () => {
          notifyToast('success', 'Discord RPC is connected');
        });

        setDiscordRpc(client);
      }
    }
  }, [config.external.discord.clientId, config.external.discord.enabled, discordRpc?.client]);

  useEffect(() => {
    if (!config.external.discord.enabled) {
      try {
        discordRpc?.destroy();
      } catch (err) {
        notifyToast('error', `${err}`);
      }
    }
  }, [config.external.discord.enabled, discordRpc]);

  useEffect(() => {
    if (config.external.discord.enabled) {
      const setActivity = async () => {
        if (!discordRpc) {
          return;
        }

        const currentPlayer =
          playQueue.currentPlayer === 1
            ? playersRef.current?.player1.audioEl.current
            : playersRef.current?.player2.audioEl.current;

        const now = Date.now();
        const start = Math.round(now - currentPlayer.currentTime * 1000) || 0;
        const end = Math.round(start + playQueue?.current?.duration * 1000) || 0;

        const artists = playQueue.current?.artist.map((artist: Artist) => artist.title).join(', ');

        const activity: Presence = {
          details: playQueue.current?.title.padEnd(2, ' ') || 'Not playing',
          state: artists || 'Unknown artist',
          largeImageKey: undefined,
          largeImageText: playQueue.current?.album || 'Unknown album',
          smallImageKey: undefined,
          smallImageText: player.status,
          instance: false,
        };

        if (player.status === 'PLAYING') {
          activity.startTimestamp = start;
          activity.endTimestamp = end;
          activity.smallImageKey = 'playing';
        } else {
          activity.smallImageKey = 'paused';
        }

        if (config.serverType === Server.Jellyfin && config.external.discord.lastfmKey !== false) {
          const song = playQueue.current;

          const albumInfo = await fetch(
            `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${
              config.external.discord.lastfmKey
            }&artist=${encodeURIComponent(song.albumArtist)}&album=${encodeURIComponent(
              song.album
            )}&format=json`
          );

          const albumInfoJson = await albumInfo.json();

          if (albumInfoJson.album?.image?.[3]['#text']) {
            activity.largeImageKey = albumInfoJson.album.image[3]['#text'];
          }
        }

        // Fall back to default icon if not set
        if (!activity.largeImageKey) {
          activity.largeImageKey = 'icon';
        }

        discordRpc.setActivity(activity);
      };

      // Activity can only be set every 15 seconds
      const interval = setInterval(() => {
        setActivity();
      }, 5e3);

      return () => clearInterval(interval);
    }
    return () => {};
  }, [
    config.external.discord.enabled,
    config.external.discord.lastfmKey,
    config.serverType,
    discordRpc,
    playQueue,
    playQueue.currentPlayer,
    player.status,
    playersRef,
  ]);
};

export default useDiscordRpc;
