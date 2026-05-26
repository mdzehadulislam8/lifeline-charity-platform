// Fetch campaign data and wire donate form
(function(){
  const id = new URLSearchParams(location.search).get('id');
  if(!id){document.getElementById('campaignTitle').innerText='No campaign specified';return}

  const goalEl = document.getElementById('goalAmount');
  const collectedEl = document.getElementById('collectedAmount');
  const titleEl = document.getElementById('campaignTitle');
  const descEl = document.getElementById('campaignDesc');
  const filesList = document.getElementById('filesList');
  const progressFill = document.getElementById('progressFill');

  function fmt(num){return '৳'+(Number(num)||0)}

  async function load(){
    const res = await fetch(`/api/campaigns/${id}`);
    if(!res.ok){titleEl.innerText='Campaign not found';return}
    const data = await res.json();
    titleEl.innerText = data.title || 'Untitled';
    descEl.innerHTML = data.description || '';
    goalEl.innerText = fmt(data.goal_amount);
    collectedEl.innerText = fmt(data.collected_amount);

    const pct = data.goal_amount>0?Math.min(100, Math.round((data.collected_amount/data.goal_amount)*100)):0;
    progressFill.style.width = pct+'%';
    progressFill.innerText = pct+'%';

    filesList.innerHTML = '';
    if(data.files && data.files.length){
      data.files.forEach(f=>{
        const a = document.createElement('a');
        a.href = f.url; a.target='_blank'; a.innerText = f.name + ' ('+f.type+')';
        const div = document.createElement('div'); div.appendChild(a);
        filesList.appendChild(div);
      })
    } else filesList.innerText = 'No documents uploaded.'
  }

  load();

  // donation submission
  const form = document.getElementById('donationForm');
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const amount = Number(document.getElementById('donationAmount').value);
    if(!amount || amount<=0){alert('Enter donation amount');return}
    const payload = {
      amount,
      donorName: document.getElementById('donorName').value || null,
      donorEmail: document.getElementById('donorEmail').value || null,
      paymentMethod: document.getElementById('paymentMethod').value || 'card',
      campaignId: id
    };

    const donationMsg = document.getElementById('donationMsg');
    donationMsg.innerText = 'Processing...';

    try{
      if(payload.paymentMethod === 'card' && window.Stripe){
        // Use Stripe flow: request clientSecret from server
        donationMsg.innerText = 'Preparing card checkout...';
        const piRes = await fetch('/api/payments/create-intent',{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount: payload.amount, campaignId: payload.campaignId, donorName: payload.donorName, donorEmail: payload.donorEmail})
        });
        const piBody = await piRes.json();
        if(!piRes.ok){ donationMsg.innerText = piBody.message || 'Failed to start payment'; return }

        const clientSecret = piBody.clientSecret;
        const stripe = Stripe(window.STRIPE_PUBLIC_KEY || '');

        // Create card element UI dynamically if not present
        let cardContainer = document.getElementById('cardElementContainer');
        if(!cardContainer){
          cardContainer = document.createElement('div');
          cardContainer.id = 'cardElementContainer';
          const cardLabel = document.createElement('label'); cardLabel.innerText = 'Card details';
          const cardDiv = document.createElement('div'); cardDiv.id = 'card-element';
          cardDiv.style.padding = '10px 0';
          form.insertBefore(cardLabel, form.querySelector('button'));
          form.insertBefore(cardDiv, form.querySelector('button'));
        }

        // Initialize elements and mount card
        const elements = stripe.elements();
        const style = { base: { fontSize: '16px' } };
        const card = elements.create('card', { style });
        card.mount('#card-element');

        donationMsg.innerText = 'Collecting card details...';

        // Confirm the card payment
        const {error, paymentIntent} = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card }
        });

        if(error){
          donationMsg.innerText = error.message || 'Card payment failed';
          return;
        }

        // Payment succeeded: update UI by fetching updated campaign totals
        donationMsg.innerText = 'Payment successful! Updating campaign...';
        // Poll GET campaign to refresh totals
        await load();
        donationMsg.innerText = 'Thank you for donating!';
        form.reset();
        if(card){ card.unmount(); }
        return;
      }

      // Fallback: server-side donation (manual/bank transfer)
      const res = await fetch('/api/donations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body = await res.json();
      if(!res.ok){ donationMsg.innerText = body.error||'Donation failed'; return }

      const totals = (body && body.data) ? body.data : body;
      if(totals && totals.collectedAmount!==undefined && totals.goalAmount!==undefined){
        goalEl.innerText = fmt(totals.goalAmount);
        collectedEl.innerText = fmt(totals.collectedAmount);
        const pct = totals.goalAmount>0?Math.min(100, Math.round((totals.collectedAmount/totals.goalAmount)*100)):0;
        progressFill.style.width = pct+'%';
        progressFill.innerText = pct+'%';
        donationMsg.innerText = 'Thank you for donating!';
        form.reset();
        return;
      }

      donationMsg.innerText = 'Donation completed';
      form.reset();
      load();
    }catch(err){donationMsg.innerText = 'Network error'; console.error(err)}
  })

})();
