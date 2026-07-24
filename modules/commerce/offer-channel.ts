import type { FulfilmentMethod, Offer, OrderChannel } from '@/data/products';

const channelNames: Record<OrderChannel, string> = {
  website: 'Website',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  physical: 'In store',
  marketplace: 'Marketplace',
};

const fulfilmentNames: Record<FulfilmentMethod, string> = {
  delivery: 'Delivery',
  pickup: 'Pickup',
  'walk-in': 'Walk in',
};

export function offerOrderChannels(offer: Offer): OrderChannel[] {
  if (offer.orderChannels?.length) return [...new Set(offer.orderChannels)];
  return ['website'];
}

export function orderChannelLabel(channel: OrderChannel) {
  return channelNames[channel];
}

export function fulfilmentMethodLabel(method: FulfilmentMethod) {
  return fulfilmentNames[method];
}

export function offerFulfilmentMethods(offer: Offer): FulfilmentMethod[] {
  return [...new Set(offer.fulfilment ?? [])];
}

export function offerActionLabel(offer: Offer) {
  const channels = offerOrderChannels(offer);
  if (channels.includes('whatsapp')) return 'Message store';
  if (channels.includes('physical')) return 'Get directions';
  if (channels.includes('instagram') || channels.includes('facebook')) return 'Open profile';
  return 'Open store';
}

export function offerFulfilmentLabel(offer: Offer) {
  const methods = [...new Set(offer.fulfilment ?? [])];
  const fulfilment = methods.map(method => fulfilmentNames[method]);
  if (offer.locationLabel) fulfilment.push(offer.locationLabel);
  return fulfilment.join(' · ') || null;
}
