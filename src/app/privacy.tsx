import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { ArrowLeft, Mail } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { LogoMark } from '@/components/logo-mark';
import { PageFooter } from '@/components/page-footer';
import {
  Appear,
  Body,
  Button,
  Caption,
  GlassCard,
  GradientBackground,
  Heading,
  Screen,
  Text,
} from '@/components/ui';
import { env } from '@/config/env';
import { colors } from '@/constants/theme';
import { CONTACT_EMAIL, PRIVACY_POLICY_UPDATED } from '@/constants/legal';
import { formatDate } from '@/utils/format-date';

// Public: the root layout puts this screen outside every guard, signed in or not. Google requires
// a reachable privacy policy to publish the OAuth consent screen.
export default function PrivacyScreen() {
  const contact = (
    <Pressable
      role="link"
      onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
      className="hover:opacity-80"
    >
      <Text weight="semibold" tone="accent" className="text-base leading-7">
        {CONTACT_EMAIL}
      </Text>
    </Pressable>
  );

  return (
    <Screen background={<GradientBackground />} scroll className="px-4 py-8 md:px-8 md:py-14">
      <Head>
        <title>Privacy · Gatehouse</title>
        <meta
          name="description"
          content="What Gatehouse collects when you sign in with Google, and why."
        />
      </Head>

      <View className="w-full max-w-[760px] gap-8 self-center">
        <Appear index={0}>
          <View className="flex-row items-center justify-between gap-4">
            <LogoMark size={40} />
            <Link href="/" asChild>
              <Button variant="ghost" size="sm" label="Back to Gatehouse" leftIcon={ArrowLeft} />
            </Link>
          </View>
        </Appear>

        <Appear index={1}>
          <View className="gap-3">
            <Caption variant="overline">Legal</Caption>
            <Heading level={1}>Privacy policy</Heading>
            <Body tone="secondary" size="lg">
              Gatehouse is a sign-in portal for the {env.allowedDomain} team. This page explains the
              little data it uses and why.
            </Body>
            <Caption>Last updated {formatDate(`${PRIVACY_POLICY_UPDATED}T12:00:00`)}</Caption>
          </View>
        </Appear>

        <Appear index={2}>
          <GlassCard padding="lg">
            <View className="gap-9">
              <Section title="What we collect">
                <Paragraph>
                  When you sign in with Google, Google shares three things with us:
                </Paragraph>
                <Bullets
                  items={[
                    'Your name',
                    'Your email address',
                    'A link to your Google profile picture',
                  ]}
                />
                <Paragraph>
                  We also record your role in Gatehouse (admin or user), when your account was
                  created and when you last signed in. We don&apos;t ask Google for anything else:
                  no contacts, files, calendar or other account data.
                </Paragraph>
              </Section>

              <Section title="Why we use it">
                <Paragraph>
                  Only for authentication and access control: to confirm you have an @
                  {env.allowedDomain} account, to keep you signed in, and to decide what you can
                  see. We don&apos;t use it for advertising, marketing or profiling.
                </Paragraph>
              </Section>

              <Section title="Where it's stored">
                <Paragraph>
                  Accounts and profiles are stored with Supabase, which provides our database and
                  sign-in service. Your session is kept on your device: in the browser&apos;s
                  storage on the web, and in encrypted device storage in the mobile app. Supabase
                  may keep standard security logs of sign-in requests.
                </Paragraph>
              </Section>

              <Section title="Sharing">
                <Paragraph>
                  We don&apos;t sell, rent or share your data. Other people only see it if they are
                  Gatehouse admins, who can see the name, email, picture, role and sign-in dates of
                  every user. The only outside services involved are Google (to sign you in) and the
                  providers that host the app and its data.
                </Paragraph>
                <Paragraph>
                  Gatehouse&apos;s use of information received from Google APIs adheres to the
                  Google API Services User Data Policy, including the Limited Use requirements.
                </Paragraph>
              </Section>

              <Section title="Deleting your data">
                <Paragraph>
                  We keep your data while you have access. To have your account and profile deleted,
                  email us from your account&apos;s address and we&apos;ll remove them. You can also
                  revoke Gatehouse&apos;s access at any time in your Google Account settings, under
                  Security.
                </Paragraph>
              </Section>

              <Section title="Contact">
                <View className="flex-row items-center gap-3">
                  <Mail size={18} color={colors.text.secondary} strokeWidth={2} />
                  {contact}
                </View>
              </Section>
            </View>
          </GlassCard>
        </Appear>

        <PageFooter />
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Heading level={3}>{title}</Heading>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Body tone="secondary" className="leading-7">
      {children}
    </Body>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View className="gap-2">
      {items.map((item) => (
        <View key={item} className="flex-row gap-3">
          <View className="mt-[11px] size-1.5 rounded-full bg-accent-cyan" />
          <Body tone="secondary" className="flex-1 leading-7">
            {item}
          </Body>
        </View>
      ))}
    </View>
  );
}
