jQuery(function ($) {
  var isSubmitting = false // Flag to track form submission
  var popupInterval // Interval ID for checking popup status
  var paymentStatusInterval // Interval ID for checking payment status
  var orderId // To store the order ID
  var $button // To store reference to the submit button
  var originalButtonText // To store original button text

  // Append loader image to the body or a specific element
  $('body').append(
    '<div class="dfinsell-loader-background"></div>' +
      '<div class="dfinsell-loader"><img src="' +
      dfinsell_params.dfin_loader +
      '" alt="Loading..." /></div>'
  )

  // Function to handle form submission
  function handleFormSubmit(e) {
    var $form = $(this)

    if (isSubmitting) {
      e.preventDefault() // Prevent the form from submitting if already in progress
      return false
    }

    isSubmitting = true // Set the flag to true to prevent multiple submissions

    var selectedPaymentMethod = $form
      .find('input[name="payment_method"]:checked')
      .val()

    if (selectedPaymentMethod !== 'dfinsell') {
      return true // Allow WooCommerce to handle the form submission if not using the custom payment method
    }

    $('.dfinsell-loader-background, .dfinsell-loader').show()

    $button = $form.find('button[type="submit"]')
    originalButtonText = $button.text()
    $button.text('Processing...').prop('disabled', true)

    var data = $form.serialize()

    setTimeout(function () {
      $.ajax({
        type: 'POST',
        url: wc_checkout_params.checkout_url,
        data: data,
        dataType: 'json',
        success: function (response) {
          handleResponse(response, $form)
        },
        error: function (jqXHR, textStatus, errorThrown) {
          handleError($form)
        },
        complete: function () {
          // Always reset isSubmitting to false in case of success or error
          isSubmitting = false
        },
      })
    }, 2000)

    e.preventDefault() // Prevent default form submission
    return false
  }

  function openPaymentLink(paymentLink) {
    var width = 700
    var height = 700
    var left = window.innerWidth / 2 - width / 2
    var top = window.innerHeight / 2 - height / 2
    var popupWindow = window.open(
      paymentLink,
      'paymentPopup',
      'width=' +
        width +
        ',height=' +
        height +
        ',scrollbars=yes,top=' +
        top +
        ',left=' +
        left
    )

    if (
      !popupWindow ||
      popupWindow.closed ||
      typeof popupWindow.closed === 'undefined'
    ) {
      // Redirect to the payment link if popup was blocked
      window.location.href = paymentLink
      resetButton()
    } else {
      popupInterval = setInterval(function () {
        if (popupWindow.closed) {
          clearInterval(popupInterval)
          resetButton()
        }
      }, 500)

      paymentStatusInterval = setInterval(function () {
        $.ajax({
          type: 'POST',
          url: dfinsell_params.ajax_url,
          data: {
            action: 'check_payment_status',
            order_id: orderId,
            security: dfinsell_params.dfinsell_nonce,
          },
          dataType: 'json',
          cache: false,
          processData: true,
          async: false,
          success: function (statusResponse) {
            if (statusResponse.data.status === 'success') {
              clearInterval(paymentStatusInterval)
              clearInterval(popupInterval)
              window.location.href = statusResponse.data.redirect_url
            } else if (statusResponse.data.status === 'failed') {
              clearInterval(paymentStatusInterval)
              clearInterval(popupInterval)
              window.location.href = statusResponse.data.redirect_url
            }
          },
        })
      }, 5000)
    }
  }

  function handleResponse(response, $form) {
    $('.dfinsell-loader-background, .dfinsell-loader').hide()
    $('.wc_er').remove()

    try {
      if (response.result === 'success') {
        orderId = response.order_id
        var paymentLink = response.payment_link
        openPaymentLink(paymentLink)

        $form.removeAttr('data-result')
        $form.removeAttr('data-redirect-url')
        isSubmitting = false
      } else {
        throw response.messages || 'An error occurred during checkout.'
      }
    } catch (err) {
      displayError(err, $form)
    }
  }

  function handleError($form) {
    $('.wc_er').remove()
    $form.prepend(
      '<div class="wc_er">An error occurred during checkout. Please try again.</div>'
    )
    $('html, body').animate(
      {
        scrollTop: $('.wc_er').offset().top - 300,
      },
      500
    )
    resetButton()
  }

  function displayError(err, $form) {
    $('.wc_er').remove()
    $form.prepend('<div class="wc_er">' + err + '</div>')
    $('html, body').animate(
      {
        scrollTop: $('.wc_er').offset().top - 300,
      },
      500
    )
    resetButton()
  }

  function resetButton() {
    isSubmitting = false
    if ($button) {
      $button.prop('disabled', false).text(originalButtonText)
    }
    $('.dfinsell-loader-background, .dfinsell-loader').hide()
  }

  $('form.checkout').off('submit').on('submit', handleFormSubmit)

  $(document.body).on('updated_checkout', function () {
    $('form.checkout').off('submit').on('submit', handleFormSubmit)
  })
})
